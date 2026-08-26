import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { localePath, type Locale } from "@/i18n/config";
import styles from "@/app/sources/library.module.css";

export function VaultMarkdown({ children, locale }: { children: string; locale: Locale }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => {
            const external = href?.startsWith("http://") || href?.startsWith("https://");
            const localizedHref = href && !external ? localePath(locale, href) : href;
            return (
              <a href={localizedHref} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                {linkChildren}
              </a>
            );
          },
          h2: ({ children: headingChildren }) => {
            const text = String(headingChildren);
            const page = text.match(/^Page (\d+)$/);
            return <h2 id={page ? `page-${page[1]}` : undefined}>{headingChildren}</h2>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
