import { sourcePackSchema, type SourcePack } from "@/lib/research/source-pack";
import federal from "./federal.json";

// State, county and city packs join this list once the demo states are chosen.
export const SOURCE_PACKS: SourcePack[] = [federal].map((pack) => sourcePackSchema.parse(pack));
