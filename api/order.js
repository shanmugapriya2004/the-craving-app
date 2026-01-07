import express from "express";
import supabase from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/orders/add
 */
router.post("/add", authMiddleware, async (req, res) => {
  const { cart_id, dishes, summary, payment_method, address } = req.body;

  // 🔑 User ID from auth middleware
  const userId = req.user.userid;

  /* -----------------------------
     🔴 Validations
  ----------------------------- */
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  if (!cart_id) {
    return res.status(400).json({ message: "Cart ID is required" });
  }

  if (!Array.isArray(dishes) || dishes.length === 0) {
    return res.status(400).json({ message: "No dishes provided" });
  }

  if (!summary?.subtotal || !summary?.total) {
    return res.status(400).json({ message: "Invalid order summary" });
  }

  if (!address) {
    return res.status(400).json({ message: "Address is required" });
  }

  try {
    /* -----------------------------
       1️⃣ Create Order
    ----------------------------- */
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        subtotal: summary.subtotal,
        delivery_fee: summary.delivery_fee,
        tax: summary.tax,
        total: summary.total,
        address,
        payment_method,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    /* -----------------------------
       2️⃣ Insert Order Items
    ----------------------------- */
    const orderItems = dishes.map((item) => ({
      order_id: order.id,
      product_id: item.productid,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    /* -----------------------------
       3️⃣ Mark Cart as Ordered ✅
    ----------------------------- */
    const { error: cartError } = await supabase
      .from("cart")
      .update({
        is_ordered: true,
      })
      .eq("id", cart_id)
      .eq("user_id", userId); // security check

    if (cartError) throw cartError;

    /* -----------------------------
       4️⃣ Response
    ----------------------------- */
    return res.status(201).json({
      message: "Order placed successfully",
      order_id: order.id,
      status: order.order_status,
      user_id: userId,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    return res.status(500).json({
      message: "Failed to place order",
    });
  }
});

router.get("/my-orders", authMiddleware, async (req, res) => {
  const userId = req.user.userid; // ✅ comes from JWT

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    /* -----------------------------
       1️⃣ Fetch Orders for User
    ----------------------------- */
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
    id,
    created_at,
    packed_at,
    delivered_at,
    order_status,
    total
  `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        userId,
        userName: null,
        dishesCount: 0,
        orders: [],
      });
    }

    const orderIds = orders.map((o) => o.id);

    /* -----------------------------
       2️⃣ Fetch Order Items + Dishes
    ----------------------------- */
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select(
        `
        order_id,
        product_id,
        quantity,
        price,
        dishes (
          name,
          image_url
        )
      `
      )
      .in("order_id", orderIds);

    if (itemsError) throw itemsError;

    /* -----------------------------
       3️⃣ Group Items by Order
    ----------------------------- */
    const itemsByOrder = {};

    for (const item of items) {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }

      itemsByOrder[item.order_id].push({
        productId: item.product_id,
        productName: item.dishes?.name || null,
        productImage: item.dishes?.image_url || null,
        price: item.price,
        qty: item.quantity,
      });
    }

    /* -----------------------------
   4️⃣ Build Orders Response
----------------------------- */
    const formattedOrders = orders.map((order) => {
      // pick correct timestamp
      let timestamp;

      switch (order.order_status) {
        case "PACKED":
          timestamp = order.packed_at;
          break;
        case "DELIVERED":
          timestamp = order.delivered_at;
          break;
        default:
          timestamp = order.created_at;
      }

      const dateObj = new Date(timestamp);
      const dishes = itemsByOrder[order.id] || [];
      return {
        orderId: order.id,

        date: dateObj.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata", // ✅ FORCE IST
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),

        time: dateObj.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata", // ✅ FORCE IST
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),

        orderStatus: order.order_status,
        totalPrice: order.total,
        dishesCount: dishes.length, // ✅ per-order dishes count
        dishes: dishes,
      };
    });

    /* -----------------------------
       5️⃣ Fetch User Name (SAFE)
    ----------------------------- */
    const { data: user } = await supabase
      .from("users")
      .select("firstname")
      .eq("userid", userId) // 🔴 change to "id" if column name is id
      .maybeSingle(); // ✅ prevents crash if user not found

    /* -----------------------------
       6️⃣ Final Response
    ----------------------------- */
    return res.status(200).json({
      userId,
      userName: user?.firstname || null,
      ordersCount: formattedOrders.length,
      orders: formattedOrders,
    });
  } catch (error) {
    console.error("Fetch user orders error:", error);
    return res.status(500).json({
      message: "Failed to fetch orders",
    });
  }
});

/**
 * GET /api/orders/:orderId
 */
router.get("/:orderId", authMiddleware, async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.userid; // ✅ from JWT

  if (!orderId) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  try {
    /* -----------------------------
       1️⃣ Fetch Order
    ----------------------------- */
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        user_id,
        order_status,
        address,
        tax,
        delivery_fee,
        total
      `
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ message: "Order not found" });
    }

    /* -----------------------------
       2️⃣ Authorization (FIXED)
    ----------------------------- */
    if (order.user_id !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    /* -----------------------------
       3️⃣ Fetch Order Items + Dishes
    ----------------------------- */
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select(
        `
        product_id,
        quantity,
        price,
        dishes (
          name,
          image_url
        )
      `
      )
      .eq("order_id", orderId);

    if (itemsError) throw itemsError;

    /* -----------------------------
       4️⃣ Build Response
    ----------------------------- */
    const orderItems = items.map((item) => ({
      product_id: item.product_id,
      product_name: item.dishes?.name,
      quantity: item.quantity,
      price: item.price,
      image: item.dishes?.image_url,
    }));

    return res.status(200).json({
      order_id: order.id,
      order_status: order.order_status,
      delivery_address: order.address,
      tax: order.tax,
      delivery_fee: order.delivery_fee,
      total: order.total,
      order_items: orderItems,
    });
  } catch (error) {
    console.error("Fetch order error:", error);
    return res.status(500).json({ message: "Failed to fetch order" });
  }
});

export default router;
