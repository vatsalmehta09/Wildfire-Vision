from PIL import Image
import glob
import os

# Define the sequence of images to create a nice UI walkthrough animation
image_sequence = [
    "assets/geo-filters.png",
    "assets/historical-monthly-bar.png",
    "assets/historical-daily-line.png",
    "assets/historical-intense-map.png",
    "assets/forecast-bounds.png",
    "assets/daily-frp-forecast.png",
    "assets/hotspots-prediction-map.png",
    "assets/ai-insights.png"
]

images = []
for filename in image_sequence:
    if os.path.exists(filename):
        img = Image.open(filename)
        # Resize to a consistent width (e.g. 1200) to keep GIF size reasonable, preserving aspect ratio
        width = 1200
        wpercent = (width / float(img.size[0]))
        hsize = int((float(img.size[1]) * float(wpercent)))
        img = img.resize((width, hsize), Image.Resampling.LANCZOS)
        images.append(img)
    else:
        print(f"Missing: {filename}")

if images:
    images[0].save(
        "assets/demo-animation.gif",
        save_all=True,
        append_images=images[1:],
        optimize=True,
        duration=1500, # 1.5 seconds per frame
        loop=0
    )
    print("Successfully generated assets/demo-animation.gif")
else:
    print("No images found to generate GIF.")
