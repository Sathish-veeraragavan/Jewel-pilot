from PIL import Image, ImageOps, ImageFilter
import math
import sys

def make_badge_transparent(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    # Center of the image
    cx, cy = width / 2.0, height / 2.0
    
    # We want to find the radius of the gold circle.
    # Let's inspect pixels from the center outwards to find the gold circle border.
    # Or we can just use a fixed radius ratio. Looking at the image, the circle fits nicely.
    # The gold circle radius is approximately 42% of the width.
    radius = width * 0.42
    feather = 4.0 # pixels to smooth the edge
    
    data = img.getdata()
    new_data = []
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = img.getpixel((x, y))
            
            # Distance from center
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx*dx + dy*dy)
            
            if dist > radius + feather:
                # Outside the circle -> completely transparent
                new_data.append((0, 0, 0, 0))
            elif dist > radius - feather:
                # Smooth transition at the edge of the circle
                ratio = (radius + feather - dist) / (2 * feather)
                # Keep the gold color, but scale alpha
                new_alpha = int(a * ratio)
                # If the pixel itself is very dark, make it even more transparent
                brightness = (r + g + b) / 3.0
                if brightness < 50:
                    new_alpha = int(new_alpha * (brightness / 50.0))
                new_data.append((r, g, b, new_alpha))
            else:
                # Inside the circle
                # If the pixel is very dark (black background noise near the border), we can check its brightness.
                # However, the inside has black text ("INDIAN STANDARD", "MARK", "916", "BIS HUID").
                # We want to keep the black text inside!
                # So we just keep the pixel as is, unless it's very close to the edge and very dark.
                brightness = (r + g + b) / 3.0
                if dist > radius - 20 and brightness < 15:
                    # Fade out dark noise near the border
                    ratio = (radius - dist) / 20.0 # 0 at border, 1 deep inside
                    new_alpha = int(a * (1.0 - (1.0 - ratio) * (1.0 - brightness / 15.0)))
                    new_data.append((r, g, b, new_alpha))
                else:
                    new_data.append((r, g, b, a))
                    
    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Successfully processed image and saved to {output_path}")

if __name__ == "__main__":
    make_badge_transparent(
        "/Users/sathishveeraragavan/.gemini/antigravity-ide/brain/f01ceff2-bb12-4cf5-ae33-23a04eef3ab1/916_bis_huid_badge_black_bg_1785027795896.png",
        "/Users/sathishveeraragavan/Downloads/Jewellery webapplication for the videos/public/916_bis_huid_badge.png"
    )
