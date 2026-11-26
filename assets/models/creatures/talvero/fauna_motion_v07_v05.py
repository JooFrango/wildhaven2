"""Keyframe species-specific movement on the savanna quadruped rig."""
import math

from mathutils import Quaternion, Vector

TAU=math.tau
Y=Vector((0,1,0))
X=Vector((1,0,0))
Z=Vector((0,0,1))

# Seconds, then cadence parameters for locomotion or the name of a gesture.
HORSE = {
    'idle': (3.4,'idle'), 'walk': (1.34,'walk'), 'trot': (.87,'trot'),
    'gallop': (.75,'gallop'), 'graze': (4.0,'graze'), 'alert': (2.25,'alert'),
    'flee': (1.62,'flee'), 'kick': (1.42,'kick'), 'rest': (3.4,'rest'),
    'death': (2.3,'death'), 'drink': (4.2,'drink'), 'start': (1.25,'start'),
    'brake': (1.4,'brake'), 'turn': (1.52,'turn'), 'hit_react': (.88,'hit'),
    'lie_down': (2.6,'lie'), 'get_up': (2.52,'rise'),
}
BROWSER = {
    'idle': (3.7,'idle'), 'walk': (1.52,'walk'), 'trot': (.94,'trot'),
    'run': (.83,'run'), 'browse': (4.3,'browse'), 'chew': (2.4,'chew'),
    'alert': (2.65,'alert'), 'headbutt': (1.61,'headbutt'),
    'defend': (2.0,'defend'), 'rest': (3.6,'rest'), 'death': (2.6,'death'),
    'flee': (1.70,'flee'), 'drink': (4.5,'drink'), 'start': (1.40,'start'),
    'brake': (1.47,'brake'), 'turn': (1.61,'turn'), 'hit_react': (1.00,'hit'),
    'lie_down': (3.0,'lie'), 'get_up': (2.87,'rise'),
}
GAITS = {
    # duty, semistride, step clearance, LF/RF/LH/RH phase, vertical bounce, torso pitch
    'walk': (.66,.142,.070,(.00,.50,.74,.24),.010,.022),
    'trot': (.54,.171,.122,(.00,.50,.50,.00),.037,.017),
    'gallop': (.45,.204,.177,(.00,.15,.59,.47),.064,.115),
    'run': (.46,.171,.169,(.19,.03,.48,.60),.048,.087),
}

def ease(x):
    x=max(0,min(1,x))
    return x*x*(3-2*x)
def gate(t,a,b,c,d):
    return ease((t-a)/(b-a))*(1-ease((t-c)/(d-c)))
def sin(t):
    return math.sin(TAU*t)
def cos(t):
    return math.cos(TAU*t)

def gait(kind,t,horse,scale=1):
    duty,stride,clearance,phases,bounce,pitch=GAITS[kind]
    stride*=scale
    if not horse and kind=='walk':
        phases=(.00,.50,.81,.31)
        stride*=.94
    def cycle(phase):
        f=(t+phase)%1
        if f<=duty:
            return (stride*(1-2*f/duty),0,0)
        swing=(f-duty)/(1-duty)
        return (stride*(2*ease(swing)-1),clearance*scale*max(0,math.sin(math.pi*swing))**1.6,
                .42*sin(swing)*scale)
    foot=[cycle(p) for p in phases]
    root_z=(.52+.48*cos((2 if kind in ('walk','trot') else 1)*t+.15))*bounce*scale
    return foot,root_z,pitch*sin(t-.11)*scale

def choreography(kind,t,horse):
    foot=[(0.,0.,0.) for _ in range(4)]
    shift=Vector((0,0,0))
    pitch=roll=yaw=0.
    neck=.018*sin(t)
    neck_tip=.018*sin(t+.16)
    head=.028*sin(t+.22)
    face_yaw=.035*sin(t-.17)
    jaw=.011*(1+sin(t))
    tail=.065*sin(t-.21)
    ear=.1*gate(t,.29,.37,.45,.54)-.14*gate(t,.67,.76,.81,.94)
    if kind in GAITS:
        foot,shift.z,pitch=gait(kind,t,horse)
        neck += (.070 if kind in ('gallop','run') else .041)*sin(t-.09)
        neck_tip+=.041*sin(t-.16)
        head-=.033*sin(t-.09)
        tail+=.076*sin(t-.40)
        roll=.023*sin(t+.06) if kind=='walk' else .010*sin(t)
    elif kind in ('flee','start','brake','turn'):
        sprint='gallop' if horse else 'run'
        amount=ease((t-.12)/.32) if kind in ('start','flee') else 1-ease((t-.17)/.63)
        if kind=='turn':
            amount=gate(t,0,.19,.66,1)*.58
        foot,shift.z,pitch=gait(sprint if kind!='turn' else 'walk',t*(1.65 if kind!='turn' else 1.0),horse,amount)
        if kind in ('flee','turn'):
            glance=gate(t,.0,.12,.20,.44)
            face_yaw += (-.54 if horse else .64)*glance
            neck_tip+=.22*glance
            roll+=(-.13 if horse else .10)*gate(t,.12,.39,.63,1)
            yaw+=(.25 if kind=='turn' else .105)*gate(t,.18,.45,.61,1)
            tail+=.34*gate(t,.16,.44,.60,1)
        if kind=='brake':
            pitch-=.17*gate(t,.15,.33,.63,.94)
            shift.z-=.11*gate(t,.17,.35,.68,.94)
            shift.x-=.09*gate(t,.1,.5,.69,1)
            neck+=.21*gate(t,.20,.41,.67,.90)
    elif kind=='graze':
        bend=gate(t,.02,.30,.81,.99)
        neck+=1.00*bend
        neck_tip+=.27*bend
        head+=.32*bend
        face_yaw+=.19*sin(t*2)*bend
        jaw+=.19*(.5+.5*sin(6*t))*bend
        shift.z-=.064*bend
        foot[0]=(.13*bend,.06*gate(t,.10,.17,.17,.25),0)
        foot[1]=(-.06*bend,.031*gate(t,.17,.23,.23,.31),0)
    elif kind=='browse':
        stretch=gate(t,.05,.30,.70,.97)
        neck-=.26*stretch
        neck_tip-=.24*stretch
        head-=.45*stretch
        face_yaw+=.23*sin(t*2-.2)*stretch
        jaw+=.28*(gate(t,.32,.39,.43,.49)+gate(t,.52,.56,.60,.67))
        shift.x+=.065*stretch
        shift.z+=.028*stretch
        ear-=.32*gate(t,.22,.31,.77,.95)
    elif kind=='chew':
        jaw+=.14*(.50+.50*sin(4*t-.10))+.038*sin(3*t)
        face_yaw+=.05*sin(3*t+.12)
        ear+=.15*sin(t)
    elif kind=='drink':
        bend=gate(t,.04,.30,.77,.99)
        neck+=(1.09 if horse else 1.12)*bend
        neck_tip+=(.34 if horse else .48)*bend
        head+=.20*bend
        jaw+=.13*max(0,sin(t*8))*bend
        shift.z-=.14*bend
        shift.x+=.053*bend
        for i,sign in enumerate((1,-1)):
            foot[i]=(sign*.23*bend,.051*gate(t,.06+i*.07,.11+i*.07,.15+i*.07,.20+i*.07),0)
    elif kind=='alert':
        gaze=gate(t,.02,.17,.65,.99)
        neck-=.20*gaze
        neck_tip-=.12*gaze
        face_yaw+=(.36 if horse else -.55)*gaze
        ear+=.37*gate(t,.10,.19,.73,1)
        tail-=.22*gate(t,.21,.45,.60,.91)
        shift.x-=.026*gaze
    elif kind=='kick':
        load=gate(t,.03,.22,.28,.45)
        release=gate(t,.24,.47,.52,.75)
        recover=gate(t,.50,.62,.72,.9)
        shift.x+=.11*load+.11*release
        shift.z-=.09*load
        shift.z+=.04*release
        pitch+=.08*load+.22*release
        neck+=.52*release
        head-=.33*release
        tail-=.85*release
        for i in range(2):
            strike=gate(t,.25+i*.045,.45+i*.037,.52+i*.037,.72+i*.052)
            foot[i+2]=(-.48*strike+.10*recover,.57*strike+.14*load,-.75*strike)
        foot[0]=(.044*load,.03*gate(t,.05,.11,.13,.2),0)
    elif kind in ('headbutt','defend'):
        brace=gate(t,.02,.18,.30,.51)
        strike=gate(t,.30,.44,.48,.75) if kind=='headbutt' else gate(t,.20,.41,.72,.99)*.66
        settle=gate(t,.52,.65,.75,.98)
        pitch+=-.075*brace+.17*strike
        shift.x+=-.12*brace+.18*strike
        shift.z-=.09*brace+.043*strike
        neck+=.42*strike-.22*brace
        neck_tip+=.62*strike-.12*brace
        head+=.64*strike-.24*settle
        ear-=.35*strike+.17*brace
        tail+=.25*strike
        foot[0]=(.17*strike,.069*gate(t,.25,.32,.34,.42),0)
        foot[1]=(-.114*brace,.038*gate(t,.04,.11,.12,.18),0)
    elif kind=='hit':
        startle=gate(t,0,.14,.28,.77)
        roll=.16*startle
        pitch=-.09*startle
        face_yaw=-.49*startle
        ear=-.42*startle
        shift.x=-.10*startle
        foot[1]=(.075*startle,.094*gate(t,.05,.22,.32,.65),0)
    elif kind in ('lie','rise','rest','death'):
        progress=1-t if kind=='rise' else t
        lower=ease((progress-.12)/.73) if kind!='rest' else 1
        front=ease((progress-.08)/.57) if kind!='rest' else 1
        rear=ease((progress-.22)/.64) if kind!='rest' else 1
        shift.z-=lower*(.56 if horse else .78)
        shift.x-=.16*lower
        pitch=.20*(front-rear)+.06*lower
        roll=.10*lower
        neck+=.37*front
        neck_tip+=.23*front
        head-=.15*lower
        for i in range(4):
            change=front if i<2 else rear
            foot[i]=((-.29 if i<2 else .20)*change,.13*change,.85*change*(1 if i<2 else -1))
        if kind=='death':
            fall=ease((t-.35)/.6)
            roll=1.43*fall
            tail-=.18*fall
            jaw+=.25*fall
            face_yaw+=.15*fall
            head+=.41*fall
            shift.z-=.11*fall
    else:
        shift.z=.005*sin(t)
        shift.x=.008*sin(t-.09)
    return foot,shift,pitch,roll,yaw,neck,neck_tip,head,face_yaw,jaw,tail,ear

def rotation(bone,axis,angle):
    # Convert a rest-space animal axis into the bone's local basis.
    orient=bone.bone.matrix_local.to_quaternion()
    return Quaternion(orient.inverted()@axis,angle)

def angle(v):
    return math.atan2(-v.x,-v.z)

def leg_pose(bones,name,rest,target,root,pivot,shift,foot_pitch):
    a,b,c,_=rest
    hip=pivot+root@(a-pivot)+shift
    delta=(target-hip)
    delta.y=0
    along=delta.normalized()
    length_1=math.hypot(b.x-a.x,b.z-a.z)
    length_2=math.hypot(c.x-b.x,c.z-b.z)
    span=max(abs(length_1-length_2)+.003,min(delta.length,length_1+length_2-.004))
    in_line=(length_1**2-length_2**2+span**2)/(2*span)
    elbow=(max(0,length_1**2-in_line**2))**.5
    side=Vector((-along.z,0,along.x))
    rest_line=c-a
    rest_side=Vector((-rest_line.z,0,rest_line.x))
    knee=hip+along*in_line+side*math.copysign(elbow,(b-a).dot(rest_side))
    ankle=hip+along*span
    goals=[knee-hip,ankle-knee]
    d1=angle(goals[0])-angle(b-a)
    d2=angle(goals[1])-angle(c-b)
    upper,lower,hoof=(bones[name+'.'+part] for part in ('upper','lower','foot'))
    parent_axis=root.inverted()@Y
    pitch=angle(root@Vector((0,0,-1)))
    upper.rotation_quaternion=rotation(upper,parent_axis,d1-pitch)
    lower.rotation_quaternion=rotation(lower,parent_axis,d2-d1)
    hoof.rotation_quaternion=rotation(hoof,parent_axis,foot_pitch-d2)

def animate(rig,mesh,legs,pivot,horse):
    import bpy
    bones=rig.pose.bones
    bones_rest=bones['torso'].bone.matrix_local.to_quaternion()
    scene=bpy.context.scene
    scene.frame_end=120
    data=rig.animation_data_create()
    for i,(name,(seconds,kind)) in enumerate((HORSE if horse else BROWSER).items()):
        action=bpy.data.actions.new(name)
        data.action=action
        length=round(seconds*30)
        for frame in sorted(set(range(0,length,2))|{length}):
            scene.frame_set(frame)
            f,shift,pitch,roll,yaw,neck,tip,skull,face_yaw,jaw,tail,ear=choreography(kind,frame/length,horse)
            root=Quaternion(Z,yaw)@Quaternion(X,roll)@Quaternion(Y,pitch)
            for bone in bones:
                bone.rotation_mode='QUATERNION'
            bones['torso'].location=bones_rest.inverted()@shift
            bones['torso'].rotation_quaternion=bones_rest.inverted()@root@bones_rest
            for stem,(dx,dz,hoof) in zip(('fore.L','fore.R','hind.L','hind.R'),f,strict=True):
                c=legs[stem][2]
                target=c+Vector((dx,0,dz))
                if kind=='death':
                    collapse=ease((frame/length-.35)/.60)
                    target=target.lerp(pivot+root@(target-pivot)+shift,collapse)
                leg_pose(bones,stem,legs[stem],target,root,pivot,shift,hoof)
            angles={
                'neck':(Y,neck), 'neck_tip':(Y,tip), 'skull':(Y,skull),
                'jaw':(Y,jaw), 'tail':(Z,tail), 'tail_tip':(X,.19*sin(frame/length-.23)-tail*.71),
                'ear.L':(X,ear), 'ear.R':(X,-ear*.63),
            }
            for key,(axis,v) in angles.items():
                bones[key].rotation_quaternion=rotation(bones[key],axis,v)
            bones['skull'].rotation_quaternion @= rotation(bones['skull'],Z,face_yaw)
            if kind in ('lie','rise','rest','death','brake'):
                bpy.context.view_layer.update()
                graph=bpy.context.evaluated_depsgraph_get()
                posed=mesh.evaluated_get(graph)
                low=min((posed.matrix_world@v.co).z for v in posed.data.vertices)
                if kind in ('rest','lie','rise','death') or low<.009:
                    bones['torso'].location += bones_rest.inverted()@Vector((0,0,.009-low))
            for bone in bones:
                bone.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=bone.name)
            bones['torso'].keyframe_insert(data_path='location',frame=frame,group='torso')
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation='LINEAR'
        data.action=None
        track=data.nla_tracks.new()
        track.name=name
        track.strips.new(name,5+i*155,action)
        track.strips[0].extrapolation='NOTHING'
    for bone in bones:
        bone.rotation_quaternion.identity()
        bone.location.zero()

