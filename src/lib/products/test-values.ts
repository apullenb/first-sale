import { NO_OPTIONS, type ProductValues } from "@/lib/rules/products";

// A confirmed product with only what tests set
export const productValues = (overrides: Partial<ProductValues> = {}): ProductValues => ({
  kind: "product",
  status: "confirmed",
  origin: "owner",
  name: "Sourdough loaf",
  description: "Naturally leavened",
  descriptionBy: "owner",
  priceCents: 950,
  priceText: "",
  unitCostCents: 300,
  quantity: 12,
  duration: "",
  location: "",
  included: "",
  options: NO_OPTIONS,
  photo: null,
  ...overrides,
});
