import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "@/app/sources/library.module.css";

export function VaultMarkdown({ children }: { children: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => {
            const external = href?.startsWith("http://") || href?.startsWith("https://");
            return (
              <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
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
