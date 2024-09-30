const express = require("express");
const stripe = require("stripe")(
  "sk_test_51ORGMMAfze7OsrlFqfhx8nSA4ZtNrxSkcmWmrTncLDs8qOEfsB0xrDQe6SZBfbdE3kBjPdvinqGhPnxkrQoL3OaX00dYiP0w1c"
);
const sql = require("mssql");
const app = express();

const endpointSecret =
  "whsec_3c8a904a592591da56067e199d20e543c438da33cb79e70f33b0f63c428f66f3";
app.use(express.raw({ type: "application/json" }));
const figureOutPricePlan = (price) => {
  if (price === 1000) return "License 01";
  if (price === 2000) return "Lisence 02";
  if (price === 3000) return "Lisence 03";
};
const updateUserInDatabase = async (email, planName) => {
  try {
    const config = {
      user: "your_db_username",
      password: "your_db_password",
      server: "your_db_server",
      database: "your_db_name",
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    };

    const pool = await sql.connect(config);

    const query = `UPDATE Users SET plan = @planName WHERE email = @customerEmail`;

    const result = await pool
      .request()
      .input("customerEmail", sql.VarChar, email)
      .input("planName", sql.VarChar, planName)
      .query(query);

    console.log(`User with email ${email} updated with plan ${planName}`);
  } catch (err) {
    console.error("Error updating user:", err);
  } finally {
    sql.close();
  }
};

app.post("/hooks", async (req, res) => {
  const event = req.body;

  const sig = req.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Stripe signature verification failed: ${err}`);
    return res.status(400).send({ error: "Invalid signature" });
  }
  let planName = "";
  let customerEmail = "";

  switch (stripeEvent.type) {
    case "checkout.session.completed":
      console.log("Subscription Session completed");

    case "customer.subscription.created":
      console.log("New subscription created");
      break;

    case "invoice.payment_succeeded":
      planName = figureOutPricePlan(stripeEvent.data.object.amount_paid);

      customerEmail = stripeEvent.data.object.customer_email;
      if (customerEmail && planName) {
        await updateUserInDatabase(customerEmail, planName);
      }
      break;

    case "invoice.payment_failed":
    case "payment_intent.payment_failed":
    case "charge.failed":
    case "checkout.session.async_payment_failed":
      console.log(
        "Subscription payment failed (insufficient funds or other issues)"
      );
      break;

    case "customer.subscription.updated":
      console.log("Subscription updated");
      break;

    case "customer.subscription.deleted":
      customerEmail = stripeEvent.data.object.customer_email;
      if (customerEmail) {
        await updateUserInDatabase(customerEmail, null);
      }
      console.log("Subscription canceled or deleted");
      break;

    case "invoice.finalized":
      console.log("Invoice finalized");
      break;

    default:
    //   console.log(`Unhandled event type: ${stripeEvent.type}`);
  }

  res.send({ received: true });
});

app.listen(8000, () => console.log(`Webhook server listening on port 8000`));
