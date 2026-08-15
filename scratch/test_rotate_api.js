// Global fetch is built-in in Node 25

async function test() {
  const url = "https://jewellery-videos.vercel.app/api/media/rotate-video";
  const body = {
    source_video_url: "https://jewelry-assets.pub-a87057ed480a40f48aa92a69ba3a748f.r2.dev/videos/NC-0001.mp4", // Let's use a sample R2 url if possible
    angle: "90_cw",
    job_id: "test-rotation-job"
  };

  console.log("Sending POST request to rotate API...");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", data);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
