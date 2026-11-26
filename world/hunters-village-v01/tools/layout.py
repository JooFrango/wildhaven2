"""Village plan in Blender metres. North is +Y. glTF stores (x, h, -y)."""
import math

# id, name, east, north, width, depth, turn (degrees), first phase
LOTS = [
    ('hall','Salão dos Hunters',-4,31,16,18,0,1),
    ('forge','Forja da Brasa',-31,4,11,10,8,1),
    ('workshop','Oficina dos Entalhadores',-32,-12,8,7,16,2),
    ('store','Armazém',-23,18,8,7,-8,1),
    ('market','Mercado das Peles',12,3,10,7,-4,2),
    ('tavern','Taverna e cozinha',18,24,11,9,-15,3),
    ('house_a','Casa do Batedor',-24,36,6.8,7,-15,1),
    ('house_b','Casa da Erveira',-37,27,6,6,18,1),
    ('house_c','Casa do Curtidor',13,38,7,7,-12,2),
    ('house_d','Casa do Rastreador',30,35,7,7,-22,3),
    ('training','Pátio de treino',33,7,13,11,0,1),
    ('stable','Estábulos',32,-13,11,8,-10,3),
    ('transport','Posto das caravanas',23,-29,8,6,6,3),
    ('herbs','Horta da encosta',-24,-30,12,9,6,3),
    ('tower','Torre do Poente',-39,41,5,5,0,2),
    ('tower_e','Torre da Vigia',38,28,5,5,0,4),
]

def smooth(x):
    x = max(0.0,min(1.0,x))
    return x*x*(3-2*x)

def terrace(y):
    return 2.4*smooth((y+20)/6)+2.4*smooth((y-5)/6)+5.4*smooth((y-13)/8)

def channel_x(y):
    return -2 + 2.2*math.sin((y+18)/11)

def town_height(x,y):
    # The seasonal gully drains south inside the clearing, away from the rim.
    gully = 2.7*math.exp(-((x-channel_x(y))/2.8)**2)*smooth((-y-7)/7)
    return terrace(y)-gully

# Contiguous dirt trails; stairs, plaza and deck are detailed separately.
PATHS = [
    [(-53,-22),(-33,-21),(-12,-23),(-7,-23),(4,-23),(16,-22),(37,-25),(55,-33)],
    [(-13,-23),(-14,-13),(-12,-3),(-7,3),(-4,9),(-4,22)],
    [(7,-23),(9,-13),(6,-5),(3,1),(-7,3),(-20,-1),(-30,-3)],
    [(-16,-4),(-20,7),(-21,13),(-21,22),(-24,29)],
    [(3,1),(14,-3),(26,-1),(34,0),(42,-3)],
    [(23,-3),(24,8),(20,16),(17,18)],
    [(-21,18),(-15,22),(-15,32),(-16,40)],
    [(21,16),(28,22),(28,30),(19,32),(12,34)],
    [(-30,21),(-37,21),(-43,27),(-42,38)],
    [(-31,-21),(-31,-18)],[(-22,-23),(-23,-27)],[(23,-23),(22,-25)],
    [(35,-25),(33,-19)],[(42,-3),(44,12),(40,24)]
]

STAGES = [
    ('Acampamento','Primeiros abrigos', 'cercas de toras, braseiro e materiais de obra'),
    ('Expansão','Mercado, oficina e vigia', 'andaimes, passadiço e estandartes de obra'),
    ('Vila estabelecida','Cozinha, montarias e caravanas', 'canteiros, luminárias e troféus'),
    ('Vila completa','Segunda torre e salão cerimonial', 'chifres esculpidos, flâmulas e bancas adicionais'),
]

