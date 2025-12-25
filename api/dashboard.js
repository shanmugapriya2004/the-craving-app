import express from "express";
import supabase from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.userid;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    /* -----------------------------
       1️⃣ Fetch User Info
    ----------------------------- */
    const { data: user } = await supabase
      .from("users")
      .select("firstname")
      .eq("userid", userId)
      .maybeSingle();

    /* -----------------------------
       2️⃣ Fetch All Orders (for counts)
    ----------------------------- */
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_status")
      .eq("user_id", userId);

    if (ordersError) throw ordersError;

    const totalOrders = orders.length;

    const activeOrders = orders.filter(
      (o) => o.order_status === "PENDING"
    ).length;

    const completedOrders = orders.filter(
      (o) => o.order_status === "DELIVERED"
    ).length;

    /* -----------------------------
       3️⃣ Fetch Latest PACKED Order
    ----------------------------- */
    const { data: packedOrder } = await supabase
      .from("orders")
      .select(
        `
        id,
        total,
        order_status
      `
      )
      .eq("user_id", userId)
      .eq("order_status", "PACKED")
      .order("packed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let recentOrder = null;

    if (packedOrder) {
      /* -----------------------------
         4️⃣ Fetch Order Items
      ----------------------------- */
      const { data: items } = await supabase
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
        .eq("order_id", packedOrder.id);

      recentOrder = {
        orderID: packedOrder.id,
        dishesCount: items.length,
        total_price: packedOrder.total,
        order_status: packedOrder.order_status,
        dishes: items.map((item) => ({
          productid: item.product_id,
          productname: item.dishes?.name || null,
          productimage: item.dishes?.image_url || null,
          qty: item.quantity,
          price: item.price,
        })),
      };
    }

    /* -----------------------------
       5️⃣ Final Dashboard Response
    ----------------------------- */
    return res.status(200).json({
      userid: userId,
      username: user?.firstname || null,
      total_orders: totalOrders,
      Active_Orders: activeOrders,
      Complete_orders: completedOrders,
      Recent_order: recentOrder ? [recentOrder] : [],
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({
      message: "Failed to load dashboard",
    });
  }
});

export default router;
