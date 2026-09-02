import CampaignBuilder from "@/components/campaign-builder";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  return <CampaignBuilder mode="new" templateSlug={template ?? null} />;
}
