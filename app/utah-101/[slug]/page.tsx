import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleShell } from "@/components/utah-101";
import { ARTICLES, SOURCES, UTAH_101_PATH, articlePath, getArticle } from "@/lib/utah-101";
import { SITE_NAME, SITE_URL } from "@/lib/config";
import { ARTICLE_BODIES } from "../_articles";

// Plain content: only these slugs exist.
export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getArticle((await params).slug);
  if (!article) return { title: "Not found" };
  return {
    title: article.seoTitle,
    description: article.description,
    alternates: { canonical: articlePath(article.slug) },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: article.title,
      description: article.description,
      url: articlePath(article.slug),
    },
    twitter: { card: "summary_large_image", title: article.title, description: article.description },
  };
}

export default async function Utah101ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  const Body = ARTICLE_BODIES[slug];
  if (!article || !Body) notFound();

  const url = `${SITE_URL}${articlePath(slug)}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.description,
      url,
      dateModified: article.checked,
      inLanguage: "en-US",
      publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      citation: article.sources.map((id) => SOURCES[id].url),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Utah 101", item: `${SITE_URL}${UTAH_101_PATH}` },
        { "@type": "ListItem", position: 2, name: article.name, item: url },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ArticleShell article={article}>
        <Body />
      </ArticleShell>
    </>
  );
}
