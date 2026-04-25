import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { useState } from "react";
import { 
  Page, 
  Layout, 
  Card, 
  DataTable, 
  Button, 
  TextField, 
  BlockStack, 
  InlineStack, 
  Text,
  Badge,
  Banner,
  AppProvider
} from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json"; 

// ---> THIS IS THE MAGIC FIX <---
// Import the compiled Polaris CSS and inject it into the page
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
];
// --------------------------------

// 1. LOADER: Fetches the current Shop ID and the custom.cityzones metafield
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  const response = await admin.graphql(
    `#graphql
    query {
      shop {
        id
        metafield(namespace: "custom", key: "cityzones") {
          id
          value
        }
      }
    }`
  );
  
  const data = await response.json();
  const shopId = data.data.shop.id;
  const rawValue = data.data.shop.metafield?.value || "{}";
  
  return { 
    shopId, 
    cityZones: JSON.parse(rawValue) 
  };
};

// 2. ACTION: Saves the updated JSON back to the Shop metafield
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const shopId = formData.get("shopId");
  const updatedZones = formData.get("cityZones"); 

  const response = await admin.graphql(
    `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          key
          value
        }
        userErrors {
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "custom",
            key: "cityzones",
            type: "json",
            value: updatedZones
          }
        ]
      }
    }
  );

  const result = await response.json();
  const errors = result.data?.metafieldsSet?.userErrors || [];
  
  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true };
};

// 3. UI: The React component using Shopify Polaris
export default function Index() {
  const { shopId, cityZones: initialZones } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  
  // Local state
  const [zones, setZones] = useState(initialZones);
  const [newZoneName, setNewZoneName] = useState("");
  const [newCityInputs, setNewCityInputs] = useState({});

  // Handlers
  const handleSave = () => {
    const formData = new FormData();
    formData.append("shopId", shopId);
    formData.append("cityZones", JSON.stringify(zones));
    submit(formData, { method: "post" });
  };

  const handleAddZone = () => {
    const formattedZoneName = newZoneName.toLowerCase().replace(/\s+/g, '');
    if (formattedZoneName && !zones[formattedZoneName]) {
      setZones({ ...zones, [formattedZoneName]: [] });
      setNewZoneName("");
    }
  };

  const handleDeleteZone = (zoneKey) => {
    const updated = { ...zones };
    delete updated[zoneKey];
    setZones(updated);
  };

  const handleAddCity = (zoneKey) => {
    const city = newCityInputs[zoneKey];
    if (city && city.trim() !== "") {
      const formattedCity = city.toLowerCase().trim();
      if (!zones[zoneKey].includes(formattedCity)) {
        setZones({
          ...zones,
          [zoneKey]: [...zones[zoneKey], formattedCity]
        });
      }
      setNewCityInputs({ ...newCityInputs, [zoneKey]: "" });
    }
  };

  const handleDeleteCity = (zoneKey, cityIndex) => {
    const updatedCities = zones[zoneKey].filter((_, i) => i !== cityIndex);
    setZones({ ...zones, [zoneKey]: updatedCities });
  };

  const handleCityKeyDown = (e, zoneKey) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCity(zoneKey);
    }
  };

  // Prepare table rows
  const rows = Object.keys(zones).length === 0 ? [] : Object.entries(zones).map(([zoneKey, cities]) => {
    return [
      <Text fontWeight="bold" as="span">{zoneKey}</Text>,
      <BlockStack gap="200">
        <InlineStack gap="200" wrap={true}>
          {cities.map((city, i) => (
            <Badge key={i} onDismiss={() => handleDeleteCity(zoneKey, i)}>
              {city}
            </Badge>
          ))}
        </InlineStack>
        {cities.length === 0 && <Text tone="subdued">No cities added yet.</Text>}
      </BlockStack>,
      <BlockStack gap="200">
        <InlineStack gap="200" wrap={false} blockAlign="center">
          <TextField 
            placeholder="Add new city..."
            value={newCityInputs[zoneKey] || ""}
            onChange={(val) => setNewCityInputs({ ...newCityInputs, [zoneKey]: val })}
            onKeyDown={(e) => handleCityKeyDown(e, zoneKey)}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setNewCityInputs({ ...newCityInputs, [zoneKey]: "" })}
          />
          <Button onClick={() => handleAddCity(zoneKey)}>Add</Button>
        </InlineStack>
        <Button tone="critical" variant="plain" onClick={() => handleDeleteZone(zoneKey)}>
          Delete Zone
        </Button>
      </BlockStack>
    ];
  });

  return (
    <AppProvider i18n={enTranslations}>
      <Page 
        title="Shipping Zones Manager" 
        subtitle="Manage your city zones for the checkout shipping calculator."
        primaryAction={{ 
          content: 'Save to Store', 
          onAction: handleSave,
          loading: isSaving
        }}
      >
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card padding="0">
                {rows.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'text', 'text']}
                    headings={['Zone ID', 'Cities in Zone', 'Manage']}
                    rows={rows}
                  />
                ) : (
                  <div style={{ padding: '20px' }}>
                    <Banner tone="info">No zones found. Create your first zone below.</Banner>
                  </div>
                )}
              </Card>

              <Card title="Create a New Zone">
                <BlockStack gap="400">
                  <Text>Enter a new zone identifier (e.g., colombo, outstation). Spaces will be removed and text will be lowercased.</Text>
                  <InlineStack gap="300" align="start">
                    <TextField 
                      label="Zone Identifier" 
                      labelHidden
                      value={newZoneName} 
                      onChange={setNewZoneName} 
                      autoComplete="off" 
                      placeholder="e.g. higharea"
                    />
                    <Button onClick={handleAddZone} variant="primary">Create Zone</Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>
    </AppProvider>
  );
}