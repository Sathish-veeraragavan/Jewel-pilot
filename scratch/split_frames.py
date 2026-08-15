import os
from PIL import Image

def process():
    img_path = "/Users/sathishveeraragavan/Downloads/Jewellery webapplication for the videos/supabase/migration_demo_render.sql" # dummy path to get workspace context, we use absolute path for image
    img_path = "/Users/sathishveeraragavan/.gemini/antigravity-ide/brain/06269b67-04f7-4ed2-a283-55112a0affe1/media__1786298611503.jpg"
    out_dir = "/Users/sathishveeraragavan/.gemini/antigravity-ide/brain/06269b67-04f7-4ed2-a283-55112a0affe1/scratch/frames"
    os.makedirs(out_dir, exist_ok=True)
    
    img = Image.open(img_path).convert("RGBA")
    w, h = img.size
    
    cols = 6
    rows = 5
    
    cell_w = w / cols
    cell_h = h / rows
    
    names = [
        "01_royal_crest", "02_emerald_palace", "03_sapphire_court", "04_imperial_plum", "05_peacock_royale", "06_velvet_maroon",
        "07_forest_jewel", "08_midnight_sapphire", "09_burgundy_palace", "10_royal_teal", "11_ancient_bronze", "12_jewel_garden",
        "13_blue_dynasty", "14_plum_velvet", "15_teal_emerald", "16_crimson_court", "17_dark_chocolate", "18_purple_dynasty",
        "19_forest_palace", "20_sapphire_velvet", "21_wine_plum", "22_emerald_dynasty", "23_royal_amethyst", "24_chocolate_royale",
        "25_midnight_teal", "26_forest_emerald", "27_imperial_wine", "28_maroon_heritage", "29_peacock_sapphire", "30_royal_jewel"
    ]
    
    for r in range(rows):
        for c in range(cols):
            idx = r * cols + c
            name = names[idx]
            
            # Bounding box for crop
            x0 = int(c * cell_w)
            y0 = int(r * cell_h)
            x1 = int((c + 1) * cell_w)
            y1 = int((r + 1) * cell_h)
            
            # Crop excluding label at bottom (top 82% of height)
            h_crop = int(cell_h * 0.82)
            cell_img = img.crop((x0, y0, x1, y0 + h_crop))
            
            cw, ch = cell_img.size
            pix = cell_img.load()
            
            # Compute brightness map
            b_map = [[0.0 for _ in range(ch)] for _ in range(cw)]
            for y in range(ch):
                for x in range(cw):
                    r_val, g_val, b_val, _ = pix[x, y]
                    b_map[x][y] = (r_val + g_val + b_val) / 3.0
            
            # Ray casting inside/outside classification
            # A pixel is inside if it hits a border (brightness > 38) in all 4 directions
            threshold = 38.0
            inside = [[False for _ in range(ch)] for _ in range(cw)]
            
            for y in range(ch):
                for x in range(cw):
                    # Check left
                    has_left = any(b_map[tx][y] > threshold for tx in range(0, x))
                    # Check right
                    has_right = any(b_map[tx][y] > threshold for tx in range(x + 1, cw))
                    # Check up
                    has_up = any(b_map[x][ty] > threshold for ty in range(0, y))
                    # Check down
                    has_down = any(b_map[x][ty] > threshold for ty in range(y + 1, ch))
                    
                    if has_left and has_right and has_up and has_down:
                        inside[x][y] = True
            
            # Dilate the inside mask slightly (by 2 pixels) to ensure we don't cut off outer borders
            dilated_inside = [[False for _ in range(ch)] for _ in range(cw)]
            for y in range(ch):
                for x in range(cw):
                    if inside[x][y]:
                        dilated_inside[x][y] = True
                    else:
                        # Check neighborhood
                        found = False
                        for dx in [-2, -1, 0, 1, 2]:
                            for dy in [-2, -1, 0, 1, 2]:
                                nx, ny = x + dx, y + dy
                                if 0 <= nx < cw and 0 <= ny < ch:
                                    if inside[nx][ny]:
                                        found = True
                                        break
                            if found:
                                break
                        dilated_inside[x][y] = found
            
            # Apply alpha transparency
            for y in range(ch):
                for x in range(cw):
                    r_val, g_val, b_val, a_val = pix[x, y]
                    if dilated_inside[x][y]:
                        # Inside frame: keep original color and full opacity
                        pix[x, y] = (r_val, g_val, b_val, 255)
                    else:
                        # Outside frame: make transparent
                        pix[x, y] = (r_val, g_val, b_val, 0)
            
            # Trim extra transparent margins around the frame
            bbox = cell_img.getbbox()
            if bbox:
                cell_img = cell_img.crop(bbox)
            
            out_path = os.path.join(out_dir, f"{name}.webp")
            cell_img.save(out_path, "WEBP", quality=85)
            print(f"Processed and saved {name}.webp (Preserved inner colors perfectly)")

if __name__ == "__main__":
    process()
