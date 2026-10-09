import { LibraryLoading } from "@/components/LibraryLoading";
import LayerApp from "@/components/LayerApp";
import { PaintLibrary } from "@/components/PaintLibrary";
import { paintCatalogue } from "@/lib/paint-catalogue";
export const metadata = {
  title: "Paints",
  description:
    "Explore sourced miniature paint names, product codes and digital swatches.",
};
export default function PaintsPage() {
  return (
    <LayerApp view="paints">
      <Suspense fallback={<LibraryLoading title="Paints" />}>
        <PaintLibrary paints={paintCatalogue} />
      </Suspense>
    </LayerApp>
  );
}
import { Suspense } from "react";
