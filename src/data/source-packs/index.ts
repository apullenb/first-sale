import { sourcePackSchema, type SourcePack } from "@/lib/research/source-pack";
import austin from "./austin.json";
import federal from "./federal.json";
import texas from "./texas.json";
import travisCounty from "./travis-county.json";

// Texas, Travis County and Austin are the demo place: their official pages are read live. Other places rely on search.
export const SOURCE_PACKS: SourcePack[] = [federal, texas, travisCounty, austin].map((pack) => sourcePackSchema.parse(pack));
