const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    const { data: job, error } = await supabase
      .from("render_jobs")
      .select(`
        id, status, created_at,
        templates(id, name, config)
      `)
      .eq("id", "a16e154e-fe35-4bab-9445-46492db9a770")
      .single();

    if (error) {
      console.error(error);
      return;
    }

    console.log("Job ID:", job.id);
    console.log("Template Name:", job.templates?.name);
    console.log("Config JSON:\n", JSON.stringify(job.templates?.config, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
