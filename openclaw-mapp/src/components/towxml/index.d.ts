/**
 * Towxml markdown/HTML rendering component
 */
export interface TowxmlResult {
  child: any[];
  [key: string]: any;
}

/**
 * Parse markdown or HTML to towxml nodes
 * @param content - markdown or html string
 * @param type - 'markdown' or 'html'
 * @param base - base url for relative links
 */
export default function towxml(
  content: string,
  type: "markdown" | "html",
  base?: string,
): TowxmlResult;

/**
 * Towxml component properties
 */
export interface TowxmlComponentProps {
  nodes: TowxmlResult;
}

/**
 * JSX intrinsic element declaration for towxml component
 */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      towxml: TaroJSX.IntrinsicAttributes & TowxmlComponentProps;
    }
  }
}
