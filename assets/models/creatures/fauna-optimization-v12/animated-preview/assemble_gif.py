from pathlib import Path
from PIL import Image
HERE=Path(__file__).resolve();repo=HERE.parents[5];out=repo/"assets/models/creatures/fauna-optimization-v12/previews"
frames=[Image.open(p).convert("RGB") for p in sorted((out/"animated_frames").glob("*.png"))]
if len(frames)!=20: raise SystemExit(f"expected 20 frames, got {len(frames)}")
gif=out/"Wildhaven_Cervalume_Lobrapedra_v02_Animated_GLBS.gif";frames[0].save(gif,save_all=True,append_images=frames[1:],duration=95,loop=0,optimize=True,disposal=2);frames[0].save(out/"Wildhaven_Cervalume_Lobrapedra_v02_Animated_GLBS_Poster.png",optimize=True);print(gif)