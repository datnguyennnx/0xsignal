import { hasDom } from "./setup";

import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export { cleanup, fireEvent } from "@testing-library/react";
export { hasDom };

export const renderDom = render;

export const renderMarkup = (element: ReactElement): string => renderToStaticMarkup(element);
