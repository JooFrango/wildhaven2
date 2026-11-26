from pathlib import Path
from PIL import Image
HERE=Path(__file__).resolve();repo=HERE.parents[5];out=repo/"assets/models/creatures/fauna-optimization-v09/previews"
frames=[Image.open(p).convert("RGB") for p in sorted((out/"animated_frames").glob("*.png"))]
if len(frames)!=16: raise SystemExit(f"expected 16 frames, got {len(frames)}")
gif=out/"Wildhaven_Boscaranha_Carniroca_Animated_GLBS.gif";frames[0].save(gif,save_all=True,append_images=frames[1:],duration=105,loop=0,optimize=True,disposal=2);frames[0].save(out/"Wildhaven_Boscaranha_Carniroca_Animated_GLBS_Poster.png",optimize=True);print(gif)