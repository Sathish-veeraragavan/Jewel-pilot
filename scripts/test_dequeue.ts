import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

async function run() {
  try {
    const res = await fetch("https://jewellery-videos.vercel.app/api/renders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dequeue", worker_id: "test_worker_debug" })
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.json());
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
