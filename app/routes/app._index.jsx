const SHOP_DOMAIN = "testmesean.myshopify.com";

export const loader = async () => {
  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  
  const response = await fetch(`https://${SHOP_DOMAIN}/admin/api/2026-04/graphql.json`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "X-Shopify-Access-Token": token 
    },
    body: JSON.stringify({
      query: `query { shop { id metafield(namespace: "custom", key: "cityzones") { id value } } }`
    }),
  });
  
  const json = await response.json();
  
  // If this logs null in Vercel, the shpat key is wrong or has no permissions
  const shopId = json.data?.shop?.id;
  const cityZones = JSON.parse(json.data?.shop?.metafield?.value || "{}");
  
  return { shopId, cityZones };
};

// ... keep the rest of the Index component and action from the previous code