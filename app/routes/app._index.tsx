import { useEffect, useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Checkbox,
  TextField,
  Banner,
  DataTable,
  Modal,
  Select,
  Tabs,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ClientOnly } from "remix-utils/client-only";
import { lazy, Suspense } from "react";
import "react-quill/dist/quill.snow.css";
import type { ReactQuillProps } from 'react-quill';

const ReactQuill = lazy(() => import('react-quill'));

const ReactQuillWrapper = (props: ReactQuillProps) => (
  <ClientOnly fallback={<p>Loading editor...</p>}>
    {() => (
      <Suspense fallback={<p>Loading editor...</p>}>
        <ReactQuill {...props} />
      </Suspense>
    )}
  </ClientOnly>
);

type ReviewListing = {
  id?: string;
  shopId: string;
  platform: string;
  url: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const settings = await prisma.reviewEmailSetting.findFirst() || {
    enabled: false,
    daysToWait: 7,
    emailTemplate: "Dear customer, please leave a review...",
    subjectLine: "We'd love your feedback!",
  };

  const reviewListings = await prisma.reviewListing.findMany();

  return json({ settings, reviewListings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { shop } = await admin.rest.session;

  const formData = await request.formData();
  const action = formData.get("action") as string;

  if (action === "saveSettings") {
    const settings = {
      enabled: formData.get("enabled") === "true",
      daysToWait: parseInt(formData.get("daysToWait") as string, 10),
      emailTemplate: formData.get("emailTemplate") as string,
      subjectLine: formData.get("subjectLine") as string,
      shopId: shop,
    };

    await prisma.reviewEmailSetting.upsert({
      where: { shopId: shop },
      update: settings,
      create: settings,
    });
  } else if (action === "saveReviewListing") {
    const reviewListing = {
      shopId: shop,
      platform: formData.get("platform") as string,
      url: formData.get("url") as string,
    };

    await prisma.reviewListing.create({
      data: reviewListing
    });
  } else if (action === "updateReviewListing") {
    const id = formData.get("id") as string;
    const reviewListing = {
      platform: formData.get("platform") as string,
      url: formData.get("url") as string,
    };

    await prisma.reviewListing.update({
      where: { id },
      data: reviewListing,
    });
  } else if (action === "deleteReviewListing") {
    const id = formData.get("id") as string;
    await prisma.reviewListing.delete({ where: { id } });
  }

  const settings = await prisma.reviewEmailSetting.findFirst() || {
    enabled: false,
    daysToWait: 7,
    emailTemplate: "Dear customer, please leave a review...",
    subjectLine: "We'd love your feedback!",
  };

  const reviewListings = await prisma.reviewListing.findMany();

  return json({ settings, reviewListings });
};

export default function Index() {
  const { settings, reviewListings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [formState, setFormState] = useState<Omit<typeof settings, 'id'>>(settings);
  const [successBanner, setSuccessBanner] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [newReviewListing, setNewReviewListing] = useState<ReviewListing>({ shopId: "", platform: "", url: "" });
  const [editingListing, setEditingListing] = useState<ReviewListing | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    [],
  );

  const daysOptions = [
    {label: '1 day', value: '1'},
    {label: '3 days', value: '3'},
    {label: '5 days', value: '5'},
    {label: '7 days', value: '7'},
    {label: '14 days', value: '14'},
    {label: '30 days', value: '30'},
  ];

  useEffect(() => {
    if (actionData?.settings) {
      setFormState(actionData.settings);
      setSuccessBanner(true);
    }
  }, [actionData]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit = (action: string, listingId?: string) => {
    if (action === "saveSettings") {
      submit({ ...formState, action }, { method: "post" });
    } else if (action === "saveReviewListing") {
      submit({ ...newReviewListing, action }, { method: "post" });
    } else if (action === "updateReviewListing" && editingListing) {
      submit({ ...editingListing, action }, { method: "post" });
    } else if (action === "deleteReviewListing" && listingId) {
      submit({ id: listingId, action }, { method: "post" });
    }
  };

  const mergeTags = [
    { label: 'Customer Name', value: '{{customer_name}}' },
    { label: 'Order Number', value: '{{order_number}}' },
    { label: 'Product Name', value: '{{product_name}}' },
    ...reviewListings.map(listing => ({ label: `${listing.platform} Review URL`, value: listing.url }))
  ];

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image'],
      ['clean'],
      [{ 'merge': mergeTags.map(tag => tag.value) }]
    ],
  };

  const reviewListingsRows = reviewListings.map((listing) => [
    listing.platform,
    listing.url,
    <Button onClick={() => setEditingListing(listing)}>Edit</Button>,
    <Button tone="critical" onClick={() => {
      setDeletingListingId(listing.id);
      setIsDeleteModalOpen(true);
    }}>Delete</Button>
  ]);

  const tabs = [
    {
      id: 'email-settings',
      content: 'Email Settings',
      accessibilityLabel: 'Email Settings',
      panelID: 'email-settings-content',
    },
    {
      id: 'review-listings',
      content: 'Review Listings',
      accessibilityLabel: 'Review Listings',
      panelID: 'review-listings-content',
    },
  ];

  const emailSettingsContent = (
    <Card>
      <BlockStack gap="500">
        {successBanner && (
          <Banner
            title="Settings saved successfully"
            tone="success"
            onDismiss={() => setSuccessBanner(false)}
          />
        )}
        <Text as="h2" variant="headingMd">
          Configure Review Follow-up Emails
        </Text>
        <Checkbox
          label="Enable follow-up emails"
          checked={formState.enabled}
          onChange={(newChecked) => setFormState({ ...formState, enabled: newChecked })}
        />
        <Select
          label="Days to wait before sending"
          options={daysOptions}
          onChange={(value) => setFormState({ ...formState, daysToWait: parseInt(value, 10) })}
          value={formState.daysToWait.toString()}
        />
        <TextField
          label="Email Subject Line"
          value={formState.subjectLine}
          onChange={(value) => setFormState({ ...formState, subjectLine: value })}
          helpText="You can use merge tags here too"
          autoComplete="off"
        />
        <Text as="h3" variant="headingMd">Email Template</Text>
        {isMounted && (
          <ReactQuillWrapper
            theme="snow"
            value={formState.emailTemplate}
            onChange={(content: string) => setFormState({ ...formState, emailTemplate: content })}
            modules={modules}
            style={{ height: '300px', marginBottom: '50px' }}
          />
        )}
        <BlockStack gap="200">
          <Text as="h4" variant="headingMd">Available Merge Tags:</Text>
          {mergeTags.map((tag) => (
            <Text as="p" key={tag.value}>{tag.label}: {tag.value}</Text>
          ))}
        </BlockStack>
        <Button onClick={() => handleSubmit("saveSettings")}>Save Settings</Button>
      </BlockStack>
    </Card>
  );

  const reviewListingsContent = (
    <Card>
      <BlockStack gap="500">
        <Text as="h2" variant="headingMd">
          Review Listings
        </Text>
        <DataTable
          columnContentTypes={['text', 'text', 'text', 'text']}
          headings={['Platform', 'URL', 'Edit', 'Delete']}
          rows={reviewListingsRows}
        />
        <TextField
          label="Platform"
          value={newReviewListing.platform}
          onChange={(value) => setNewReviewListing({ ...newReviewListing, platform: value })}
          autoComplete="off"
        />
        <TextField
          label="URL"
          value={newReviewListing.url}
          onChange={(value) => setNewReviewListing({ ...newReviewListing, url: value })}
          autoComplete="off"
        />
        <Button onClick={() => handleSubmit("saveReviewListing")}>Add Review Listing</Button>
      </BlockStack>
    </Card>
  );

  return (
    <Page>
      <TitleBar title="Review Email Settings" />
      <Layout>
        <Layout.Section>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            {selectedTab === 0 ? emailSettingsContent : reviewListingsContent}
          </Tabs>
        </Layout.Section>
      </Layout>

      {editingListing && (
        <Modal
          open={true}
          onClose={() => setEditingListing(null)}
          title="Edit Review Listing"
          primaryAction={{
            content: 'Save',
            onAction: () => {
              handleSubmit("updateReviewListing");
              setEditingListing(null);
            },
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setEditingListing(null),
            },
          ]}
        >
          <Modal.Section>
            <TextField
              label="Platform"
              value={editingListing.platform}
              onChange={(value) => setEditingListing({ ...editingListing, platform: value })}
              autoComplete="off"
            />
            <TextField
              label="URL"
              value={editingListing.url}
              onChange={(value) => setEditingListing({ ...editingListing, url: value })}
              autoComplete="off"
            />
          </Modal.Section>
        </Modal>
      )}

      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Review Listing"
        primaryAction={{
          content: 'Delete',
          onAction: () => {
            if (deletingListingId) {
              handleSubmit("deleteReviewListing", deletingListingId);
            }
            setIsDeleteModalOpen(false);
          },
          destructive: true,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsDeleteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <p>Are you sure you want to delete this review listing?</p>
        </Modal.Section>
      </Modal>
    </Page>
  );
}