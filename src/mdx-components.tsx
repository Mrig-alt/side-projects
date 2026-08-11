import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => (
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6" {...props} />
    ),
    h2: (props) => (
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-12 mb-4" {...props} />
    ),
    h3: (props) => (
      <h3 className="text-xl font-semibold mt-8 mb-3" {...props} />
    ),
    p: (props) => (
      <p className="text-lg leading-relaxed text-foreground/80 mb-5" {...props} />
    ),
    a: (props) => (
      <a className="underline underline-offset-4 hover:text-foreground" {...props} />
    ),
    ul: (props) => (
      <ul className="list-disc pl-6 mb-5 space-y-2 text-foreground/80" {...props} />
    ),
    li: (props) => <li className="text-lg leading-relaxed" {...props} />,
    blockquote: (props) => (
      <blockquote
        className="border-l-2 border-line pl-6 italic text-foreground/70 my-6"
        {...props}
      />
    ),
    hr: (props) => <hr className="border-line my-10" {...props} />,
    ...components,
  };
}
