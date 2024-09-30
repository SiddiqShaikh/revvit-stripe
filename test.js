
const express = require('express');
const app = express();
const stripe = require('stripe')('YOUR_STRIPE_SECRET_KEY');
const sql = require('sql');

// SQL connection settings
const dbConfig = {
  user: 'YOUR_SQL_USERNAME',
  password: 'YOUR_SQL_PASSWORD',
  server: 'YOUR_SQL_SERVER',
  database: 'YOUR_SQL_DATABASE',
};

// Initialize SQL connection
const pool = new sql.ConnectionPool(dbConfig);

app.post('/stripe-webhook', async (req, res) => {
  const event = req.body;

  // Verify Stripe signature
  const sig = req.headers['stripe-signature'];
  const webhookSecret = 'YOUR_STRIPE_WEBHOOK_SECRET';
  try {
    const stripeEvent = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`Received event: ${stripeEvent.type}`);
  } catch (err) {
    console.error(`Stripe signature verification failed: ${err}`);
    return res.status(400).send({ error: 'Invalid signature' });
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.send({ received: true });
});

// Helper functions
async function handleCheckoutSessionCompleted(session) {
  const customerEmail = session.customer_email;
  const productId = session.client_reference_id;
  const buttonId = session.metadata.button_id;

  // Update database with purchase details
  const query = `
    INSERT INTO purchases (customer_email, product_id, button_id)
    VALUES (@customerEmail, @productId, @buttonId);
  `;
  await pool.query(query, {
    customerEmail,
    productId,
    buttonId,
  });
}

async function handleInvoicePaid(invoice) {
  const customerEmail = invoice.customer_email;
  const subscriptionId = invoice.subscription;

  // Update database with payment details
  const query = `
    UPDATE subscriptions
    SET status = 'active'
    WHERE customer_email = @customerEmail AND subscription_id = @subscriptionId;
  `;
  await pool.query(query, {
    customerEmail,
    subscriptionId,
  });
}

async function handleInvoicePaymentFailed(invoice) {
  const customerEmail = invoice.customer_email;
  const subscriptionId = invoice.subscription;

  // Update database with payment failure
  const query = `
    UPDATE subscriptions
    SET status = 'failed'
    WHERE customer_email = @customerEmail AND subscription_id = @subscriptionId;
  `;
  await pool.query(query, {
    customerEmail,
    subscriptionId,
  });
}

async function handleSubscriptionUpdated(subscription) {
  const customerEmail = subscription.customer_email;
  const subscriptionId = "";
  const status = subscription.status;

  // Update database with subscription status
  const query = `
    UPDATE subscriptions
    SET status = @status
    WHERE customer_email = @customerEmail AND subscription_id = @subscriptionId;
  `;
  await pool.query(query, {
    customerEmail,
    subscriptionId,
    status,
  });
}

async function handleSubscriptionDeleted(subscription) {
  const customerEmail = subscription.customer_email;
  const subscriptionId = "asdsad";

  // Update database with subscription deletion
  const query = `
    DELETE FROM subscriptions
    WHERE customer_email = @customerEmail AND subscription_id = @subscriptionId;
  `;
  await pool.query(query, {
    customerEmail,
    subscriptionId,
  });
}

// Start server
const port = 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
