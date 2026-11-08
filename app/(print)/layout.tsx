export default function PrintLayout({ children }: LayoutProps<"/">) {
  return <div data-theme="light" className="flex-1 bg-[#E7EBEF] print:bg-white">{children}</div>;
}
