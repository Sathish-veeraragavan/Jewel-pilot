import os
from PIL import Image, ImageDraw, ImageFilter
import math

def create_spear_flourish(filename, size=(160, 160), color="#D4AF37"):
    scale = 4
    w, h = size[0] * scale, size[1] * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = w / 2.0, h / 2.0
    
    # 1. Main flame/spearhead pointing left
    # Tip at left (x=10%), base at right
    tip_x, tip_y = w * 0.1, cy
    center_x = w * 0.55
    
    # Outer leaf path
    points = [
        (tip_x, tip_y),
        (w * 0.35, cy - h * 0.35),
        (w * 0.7, cy - h * 0.4),
        (w * 0.9, cy - h * 0.2),
        (w * 0.75, cy),
        (w * 0.9, cy + h * 0.2),
        (w * 0.7, cy + h * 0.4),
        (w * 0.35, cy + h * 0.35),
    ]
    draw.polygon(points, fill=color)
    
    # Inner cutout for filigree scroll effect
    inner_cutout = [
        (w * 0.45, cy),
        (w * 0.65, cy - h * 0.2),
        (w * 0.8, cy - h * 0.1),
        (w * 0.7, cy),
        (w * 0.8, cy + h * 0.1),
        (w * 0.65, cy + h * 0.2),
    ]
    draw.polygon(inner_cutout, fill=(0, 0, 0, 0))
    
    # Add gold accent dots
    draw.ellipse([w * 0.85 - 15, cy - 15, w * 0.85 + 15, cy + 15], fill=color)
    
    img = img.resize(size, Image.Resampling.LANCZOS)
    img.save(filename, "PNG")
    print(f"Created spear flourish: {filename}")

def create_diamond_flourish(filename, size=(160, 160), color="#D4AF37"):
    scale = 4
    w, h = size[0] * scale, size[1] * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = w / 2.0, h / 2.0
    # Central diamond
    ds = w * 0.3
    draw.polygon([(cx, cy - ds), (cx + ds, cy), (cx, cy + ds), (cx - ds, cy)], fill=color)
    
    # Four smaller corner diamonds
    for angle in [0, 90, 180, 270]:
        rad = math.radians(angle)
        dist = w * 0.38
        px, py = cx + math.cos(rad) * dist, cy + math.sin(rad) * dist
        s = w * 0.08
        draw.polygon([(px, py - s), (px + s, py), (px, py + s), (px - s, py)], fill=color)
        
    img = img.resize(size, Image.Resampling.LANCZOS)
    img.save(filename, "PNG")
    print(f"Created diamond flourish: {filename}")

def create_flower_flourish(filename, size=(160, 160), color="#D4AF37"):
    scale = 4
    w, h = size[0] * scale, size[1] * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = w / 2.0, h / 2.0
    num_petals = 8
    r_outer = w * 0.38
    r_inner = w * 0.15
    
    for i in range(num_petals):
        angle = (i * 360 / num_petals)
        rad = math.radians(angle)
        px = cx + math.cos(rad) * r_outer
        py = cy + math.sin(rad) * r_outer
        draw.ellipse([px - w*0.08, py - h*0.08, px + w*0.08, py + h*0.08], fill=color)
        
    draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], fill=color)
    img = img.resize(size, Image.Resampling.LANCZOS)
    img.save(filename, "PNG")
    print(f"Created flower flourish: {filename}")

def create_ornate_line(filename, size=(600, 30), color="#D4AF37"):
    scale = 4
    w, h = size[0] * scale, size[1] * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cy = h / 2.0
    # Tapered line
    for i in range(int(w)):
        progress = i / w
        # Thickness vanishes at edges, max at center
        thick = (math.sin(progress * math.pi) ** 2) * (h * 0.35)
        if thick > 0.5:
            draw.line([(i, cy - thick/2), (i, cy + thick/2)], fill=color)
            
    img = img.resize(size, Image.Resampling.LANCZOS)
    img.save(filename, "PNG")
    print(f"Created ornate line: {filename}")

def main():
    out_dir = "/Users/sathishveeraragavan/Downloads/Jewellery webapplication for the videos/public/presets"
    os.makedirs(out_dir, exist_ok=True)
    
    create_spear_flourish(f"{out_dir}/spear_flourish_gold.png", color="#D4AF37")
    create_spear_flourish(f"{out_dir}/spear_flourish_red.png", color="#E11D48")
    create_spear_flourish(f"{out_dir}/spear_flourish_white.png", color="#FFFFFF")
    
    create_diamond_flourish(f"{out_dir}/diamond_flourish_gold.png", color="#D4AF37")
    create_diamond_flourish(f"{out_dir}/diamond_flourish_white.png", color="#FFFFFF")
    
    create_flower_flourish(f"{out_dir}/flower_flourish_gold.png", color="#D4AF37")
    create_flower_flourish(f"{out_dir}/flower_flourish_red.png", color="#E11D48")
    
    create_ornate_line(f"{out_dir}/line_ornate_gold.png", color="#D4AF37")
    create_ornate_line(f"{out_dir}/line_ornate_white.png", color="#FFFFFF")
    create_ornate_line(f"{out_dir}/line_ornate_red.png", color="#E11D48")

if __name__ == "__main__":
    main()
