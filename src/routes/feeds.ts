import { Router } from "express";

import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  try {
    res.json({ feeds: [] });
  } catch (err) {  // any-ok
    res.status(500).json({ error: "Failed to fetch feeds" });
  }
}));

export default router;