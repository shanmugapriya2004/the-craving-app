import express from "express";
import supabase from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user?.userid;

  try {
    /* -----------------------------
       1️⃣ Get Active Cart
    ----------------------------- */
    const { data: cart, error: cartError } = await supabase
      .from("cart")
      .select("id")
      .eq("user_id", userId)
      .eq("is_ordered", false)
      .maybeSingle();

    if (cartError) throw cartError;

    // 🟡 No active cart
    if (!cart) {
      return res.status(200).json({
        success: true,
        cartId: null,
        items: [],
        orderSummary: {
          totalItems: 0,
          subtotal: 0,
          tax: 0,
          deliveryFee: 0,
          grandTotal: 0,
        },
      });
    }

    /* -----------------------------
       2️⃣ Get Cart Items
    ----------------------------- */
    const { data: items, error: itemsError } = await supabase
      .from("cart_items")
      .select(
        `
        id,
        quantity,
        dishes (*)
      `
      )
      .eq("cart_id", cart.id);

    if (itemsError) throw itemsError;

    /* -----------------------------
       3️⃣ Calculate Totals
    ----------------------------- */
    let totalItems = 0;
    let subtotal = 0;

    const formattedItems = items.map((item) => {
      const price = item.dishes?.price || 0;
      const itemTotal = price * item.quantity;

      totalItems += item.quantity;
      subtotal += itemTotal;

      return {
        ...item,
        itemTotal,
      };
    });

    // ✅ Pricing rules
    const tax = Number((subtotal * 0.05).toFixed(2));
    const deliveryFee = subtotal <= 500 ? subtotal * 0.02 : 0;
    const grandTotal = subtotal + tax + deliveryFee;

    /* -----------------------------
       4️⃣ Response
    ----------------------------- */
    return res.status(200).json({
      success: true,
      cartId: cart.id,
      items: formattedItems,
      orderSummary: {
        totalItems,
        subtotal,
        tax,
        deliveryFee,
        grandTotal,
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/add", authMiddleware, async (req, res) => {
  const userId = req.user?.userid;
  const { dishId } = req.body;

  if (!dishId) {
    return res.status(400).json({ message: "dishId is required" });
  }

  try {
    /* -----------------------------
       1️⃣ Check Dish Exists
    ----------------------------- */
    const { data: dish, error: dishError } = await supabase
      .from("dishes")
      .select("id")
      .eq("id", dishId)
      .single();

    if (dishError || !dish) {
      return res.status(404).json({ message: "Dish not found" });
    }

    /* -----------------------------
       2️⃣ Get or Create Cart
    ----------------------------- */
    let { data: cart, error: cartError } = await supabase
      .from("cart")
      .select("id")
      .eq("user_id", userId)
      .eq("is_ordered", false)
      .maybeSingle();

    if (cartError) throw cartError;

    // 🆕 Create cart if not exists
    if (!cart) {
      const { data: newCart, error: newCartError } = await supabase
        .from("cart")
        .insert({
          user_id: userId,
          is_ordered: false,
        })
        .select()
        .single();

      if (newCartError) throw newCartError;
      cart = newCart;
    }

    /* -----------------------------
       3️⃣ Check Cart Item
    ----------------------------- */
    const { data: cartItem, error: itemError } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cart.id)
      .eq("dish_id", dishId)
      .maybeSingle();

    if (itemError) throw itemError;

    /* -----------------------------
       4️⃣ Insert OR Update Item
    ----------------------------- */
    if (!cartItem) {
      // ➕ Insert new item
      const { error: insertError } = await supabase.from("cart_items").insert({
        cart_id: cart.id,
        dish_id: dishId,
        quantity: 1,
      });

      if (insertError) throw insertError;
    } else {
      // ➕ Update quantity
      const { error: updateError } = await supabase
        .from("cart_items")
        .update({
          quantity: cartItem.quantity + 1,
          updated_at: new Date(),
        })
        .eq("id", cartItem.id);

      if (updateError) throw updateError;
    }

    return res.status(200).json({
      success: true,
      message: "Product added to cart",
      cartId: cart.id, // ✅ same for all items
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/increase", authMiddleware, async (req, res) => {
  const userId = req.user?.userid;
  const { cartId, dishId } = req.body;

  if (!cartId || !dishId) {
    return res.status(400).json({ message: "cartId and dishId are required" });
  }

  try {
    /* -----------------------------
       1️⃣ Verify Cart Ownership
    ----------------------------- */
    const { data: cart } = await supabase
      .from("cart")
      .select("id")
      .eq("id", cartId)
      .eq("user_id", userId)
      .eq("is_ordered", false)
      .maybeSingle();

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    /* -----------------------------
       2️⃣ Find Cart Item (FIXED)
    ----------------------------- */
    const { data: item } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("dish_id", dishId)
      .maybeSingle(); // ✅ IMPORTANT

    console.log("Increase request:", {
      cartId,
      dishId,
      userId,
    });

    if (!item) {
      return res.status(404).json({
        message: "Item not found in cart",
        debug: { cartId, dishId },
      });
    }

    /* -----------------------------
       3️⃣ Increase Quantity
    ----------------------------- */
    await supabase
      .from("cart_items")
      .update({
        quantity: item.quantity + 1,
        updated_at: new Date(),
      })
      .eq("id", item.id);

    return res.status(200).json({
      success: true,
      message: "Quantity increased",
    });
  } catch (error) {
    console.error("Increase error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/decrease", authMiddleware, async (req, res) => {
  const userId = req.user?.userid;
  const { cartId, dishId } = req.body;

  if (!cartId || !dishId) {
    return res.status(400).json({ message: "cartId and dishId are required" });
  }

  try {
    /* -----------------------------
       1️⃣ Verify Cart Ownership
    ----------------------------- */
    const { data: cart } = await supabase
      .from("cart")
      .select("id")
      .eq("id", cartId)
      .eq("user_id", userId)
      .eq("is_ordered", false)
      .maybeSingle();

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    /* -----------------------------
       2️⃣ Find Cart Item
    ----------------------------- */
    const { data: item } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("dish_id", dishId)
      .maybeSingle();

    console.log("Decrease request:", { cartId, dishId, userId });

    if (!item) {
      return res.status(404).json({
        message: "Item not found in cart",
        debug: { cartId, dishId },
      });
    }

    /* -----------------------------
       3️⃣ Decrease or Delete
    ----------------------------- */
    if (item.quantity > 1) {
      // 🔽 decrease quantity
      await supabase
        .from("cart_items")
        .update({
          quantity: item.quantity - 1,
          updated_at: new Date(),
        })
        .eq("id", item.id);

      return res.status(200).json({
        success: true,
        message: "Quantity decreased",
      });
    } else {
      // 🗑 quantity === 1 → delete row
      await supabase.from("cart_items").delete().eq("id", item.id);

      return res.status(200).json({
        success: true,
        message: "Item removed from cart",
      });
    }
  } catch (error) {
    console.error("Decrease error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/remove", authMiddleware, async (req, res) => {
  const userId = req.user?.userid;
  const { cartId, dishId } = req.body;

  if (!cartId || !dishId) {
    return res.status(400).json({ message: "cartId and dishId are required" });
  }

  try {
    /* -----------------------------
       1️⃣ Verify Cart Ownership
    ----------------------------- */
    const { data: cart } = await supabase
      .from("cart")
      .select("id")
      .eq("id", cartId)
      .eq("user_id", userId)
      .eq("is_ordered", false)
      .maybeSingle();

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    /* -----------------------------
       2️⃣ Delete Cart Item
    ----------------------------- */
    const { data: deletedItem, error } = await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cartId)
      .eq("dish_id", dishId)
      .select("id");

    console.log("Remove request:", { cartId, dishId, userId });

    if (error) {
      throw error;
    }

    if (!deletedItem || deletedItem.length === 0) {
      return res.status(404).json({
        message: "Item not found in cart",
        debug: { cartId, dishId },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Item removed from cart",
    });
  } catch (error) {
    console.error("Remove error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
