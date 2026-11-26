from pathlib import Path
from PIL import Image
HERE=Path(__file__).resolve();repo=HERE.parents[5]
out=repo/"assets/models/creatures/fauna-optimization-v07/previews"
frames=[Image.open(p).convert("RGB") for p in sorted((out/"animated_frames").glob("*.png"))]
gif=out/"Wildhaven_Silvarano_Folhisco_Animated_GLBS.gif"
frames[0].save(gif,save_all=True,append_images=frames[1:],duration=105,loop=0,optimize=True,disposal=2)
frames[0].save(out/"Wildhaven_Silvarano_Folhisco_Animated_GLBS_Poster.png",optimize=True)
print(gif)
