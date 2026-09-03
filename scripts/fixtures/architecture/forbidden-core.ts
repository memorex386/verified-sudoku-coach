import { z } from "zod";

export const unsafeTimestamp = z.number().parse(Date.now());
