import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { shopifyApi, LATEST_API_VERSION, Session } from "@shopify/shopify-api";
import { processEmailTemplate, sendEmail } from "../utils/email.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Validate the CRON_SECRET
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');

    if (!secret || secret !== process.env.CRON_SECRET) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all shops with enabled review emails
    const shops = await prisma.reviewEmailSetting.findMany({
      where: { enabled: true },
      select: { shopId: true, daysToWait: true, emailTemplate: true, subjectLine: true },
    });

    const results = [];

    for (const shop of shops) {
      try {
        // Fetch the offline session token for this shop
        const offlineSession = await prisma.session.findFirst({
          where: { shop: shop.shopId, isOnline: false },
        });

        if (!offlineSession) {
          results.push({ shopId: shop.shopId, error: "No offline session found" });
          continue;
        }

        // Create a new Shopify GraphQL client using the offline session
        const shopify = shopifyApi({
          apiKey: process.env.SHOPIFY_API_KEY!,
          apiSecretKey: process.env.SHOPIFY_API_SECRET!,
          scopes: process.env.SCOPES!.split(','),
          hostName: process.env.HOST!.replace(/https:\/\//, ''),
          apiVersion: LATEST_API_VERSION,
          isEmbeddedApp: true,
        });

        const client = new shopify.clients.Graphql({
          session: new Session({
            id: offlineSession.id,
            shop: offlineSession.shop,
            state: offlineSession.state,
            isOnline: offlineSession.isOnline,
            accessToken: offlineSession.accessToken,
          }),
        });

        // Use the client to fetch recent orders
        const response = await client.query<{
          data: {
            orders: {
              edges: Array<{
                node: {
                  id: string;
                  name: string;
                  createdAt: string;
                  customer: {
                    firstName: string;
                    lastName: string;
                    email: string;
                  };
                  lineItems: {
                    edges: Array<{
                      node: {
                        title: string;
                      };
                    }>;
                  };
                };
              }>;
            };
          };
        }>({
          data: `
            query {
              orders(first: 50, sortKey: CREATED_AT, reverse: true) {
                edges {
                  node {
                    id
                    name
                    createdAt
                    customer {
                      firstName
                      lastName
                      email
                    }
                    lineItems(first: 1) {
                      edges {
                        node {
                          title
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
        });

        const orders = response.body.data?.orders?.edges?.map((edge) => edge.node) ?? [];
        
        
        const emailsSent = [];

        for (const order of orders) {
          const orderDate = new Date(order.createdAt);
          const daysSinceOrder = Math.floor((new Date().getTime() - orderDate.getTime()) / (1000 * 3600 * 24));

          if (daysSinceOrder === shop.daysToWait || true) {
            const existingSentEmail = await prisma.sentReviewEmail.findUnique({
              where: { shopId_orderId: { shopId: shop.shopId, orderId: order.id } },
            });

            if (!existingSentEmail) {
              const customer = order.customer;
              const productName = order.lineItems.edges[0]?.node.title || "your recent purchase";

              const emailContent = processEmailTemplate(shop.emailTemplate, {
                customer_name: `${customer.firstName} ${customer.lastName}`,
                order_number: order.name,
                product_name: productName,
              });
              const subjectLine = processEmailTemplate(shop.subjectLine, {
                customer_name: `${customer.firstName} ${customer.lastName}`,
                order_number: order.name,
                product_name: productName,
              });
              await sendEmail(customer.email, subjectLine, emailContent);

              await prisma.sentReviewEmail.create({
                data: {
                  shopId: shop.shopId,
                  orderId: order.id,
                },
              });

              emailsSent.push(order.id);
            }
          }
        }

        results.push({ shopId: shop.shopId, emailsSent });
      } catch (shopError) {
        console.error(`Error processing shop ${shop.shopId}:`, shopError);
        results.push({ shopId: shop.shopId, error: (shopError as Error).message });
      }
    }

    return json({ results });
  } catch (error) {
    console.error("Error processing review emails:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: "Failed to process review emails", details: errorMessage }, { status: 500 });
  }
};