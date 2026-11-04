"use client";

import { useState } from "react";
import Link from "next/link";
import { ItemPictures } from "@/components/products/item-pictures";
import type { ItemPicture, ListedProduct } from "@/components/products/product-list";
import { INPUT, SECONDARY_LINK } from "@/components/styles";
import { Card } from "@/components/ui";

export function ServicePhotos({ services, pictures, changeLimit }: { services: ListedProduct[]; pictures: ItemPicture[]; changeLimit: number }) {
  const [selected, setSelected] = useState(services[0]?.id ?? "");
  const service = services.find((item) => item.id === selected) ?? services[0];
  return <Card title="Generate a service photo" icon="sparkles" id="generate-service-heading">
    <p className="text-rule">Create a picture from a service’s description, in your brand’s style. No upload needed.</p>
    {service ? <>
      <label className="flex flex-col gap-2 font-semibold">Choose a service<select aria-label="Choose a service" className={INPUT} value={service.id} onChange={(event) => setSelected(event.target.value)}>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <ItemPictures key={service.id} item={service} pictures={pictures.filter((picture) => picture.productId === service.id)} inUse={service.photo?.source === "generated" ? service.photo.pictureId : null} changeLimit={changeLimit} hasOwnPhoto={service.photo !== null && service.photo.source !== "generated"} />
    </> : <><p className="text-muted">Add a service and a short description first so SnapStart knows what to show.</p><Link className={SECONDARY_LINK} href="/products">Add your services →</Link></>}
  </Card>;
}
