"""Pose and bake the bird and lizard independently at 30 FPS."""
import math

from mathutils import Quaternion, Vector

X=Vector((1,0,0))
Y=Vector((0,1,0))
Z=Vector((0,0,1))
TAU=math.tau

FRUTAVIL={
    'idle':2.5,'walk':.90,'hop':.87,'perch':2.4,'peck':1.12,
    'eat_fruit':2.16,'wing_flap':1.44,'short_flight':2.30,
    'alert':1.66,'rest':3.1,'death':1.86,
    'takeoff':1.06,'glide':1.85,'land':1.10,'drink':2.3,'hit_react':.73,
}
CROMATIL={
    'idle':3.18,'walk':1.30,'scurry':.73,'bask':3.65,'forage':2.85,
    'head_tilt':1.38,'tail_whip':1.47,'threat':1.78,'retreat':1.22,
    'rest':3.42,'death':2.04,'drink':2.45,'hide':1.62,'hit_react':.86,'turn':1.45,
}
def sin(t):
    return math.sin(t*TAU)
def cos(t):
    return math.cos(t*TAU)
def ease(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)
def gate(t,a,b,c,d):
    return ease((t-a)/(b-a))*(1-ease((t-c)/(d-c)))

def step(t,duty,stride,clearance):
    t%=1
    if t<duty:
        return stride*(1-2*t/duty),0,0
    p=(t-duty)/(1-duty)
    return stride*(2*ease(p)-1),clearance*max(0,math.sin(math.pi*p))**1.35,.33*sin(p)

def bird_pose(name,t):
    shift=Vector((.004*sin(t-.10),.001*sin(t),.004*cos(t)))
    pitch,roll,yaw=.017*sin(t),.014*sin(t+.08),0
    neck=.034*sin(t-.12)
    head=.05*sin(t+.05)
    look=.045*sin(t-.09)
    jaw=.015*max(0,sin(t))
    crest=.09*sin(t-.20)
    tail=.032*sin(t-.27)
    fan=.042*sin(t+.15)
    opening=.035*gate(t,.06,.22,.56,.88)
    flap_phase,flap_amp=0.,0.
    foot=[(0.,0.,0.),(0.,0.,0.)]
    air=0.
    grip=0.
    if name=='walk':
        foot=[step(t+p,.62,.044,.041) for p in (0,.5)]
        shift.z=.010*(.5+.5*cos(t*2-.07))
        shift.y=.010*sin(t)
        neck=.105*sin(t*2-.10)
        head=-.080*sin(t*2-.15)
        tail=.075*sin(2*t-.24)
    elif name=='hop':
        compress=gate(t,.02,.18,.24,.36)
        air=gate(t,.24,.42,.52,.72)
        shift.z=.165*air-.027*compress
        pitch=-.13*air+.16*compress
        opening=.42*air
        flap_amp=.23*air
        flap_phase=2.0*t
        fan+=.29*air
    elif name in ('short_flight','takeoff','glide','land'):
        if name=='short_flight':
            air=gate(t,.12,.37,.73,.93)
            opening=gate(t,.06,.30,.80,.98)
            flap_phase=t*4.15
            flap_amp=opening*(.70-.43*gate(t,.48,.56,.68,.80))
        elif name=='takeoff':
            air=ease((t-.12)/.59)
            opening=ease((t-.04)/.28)
            flap_phase=t*2.05
            flap_amp=.77*opening
        elif name=='land':
            air=1-ease((t-.18)/.69)
            opening=1-ease((t-.54)/.40)
            flap_phase=t*1.75
            flap_amp=.58*opening
        else:
            air=opening=1
            flap_amp=.09
            flap_phase=t
        takeoff=gate(t,.04,.24,.36,.60) if name in ('short_flight','takeoff') else 0
        flare=gate(t,.56,.73,.86,.99) if name in ('short_flight','land') else 0
        shift.z=.269*air-.032*takeoff+.023*air*sin(flap_phase-.18)
        shift.x=.032*air+.038*flare
        pitch=-.17*takeoff-.21*flare+.018*sin(flap_phase)
        roll=.066*sin(flap_phase-.09)*air
        tail=.29*takeoff-.22*flare+.078*sin(flap_phase)*air
        neck=-.19*air+.15*flare
        head=.13*air
        crest=.27*air+.18*sin(flap_phase-.2)*air
    elif name=='wing_flap':
        opening=gate(t,.05,.23,.66,.97)
        flap_phase=t*2.85
        flap_amp=.72*opening
        shift.z=.015*opening*sin(flap_phase-.13)
        fan=.22*opening
        pitch=-.15*opening
        tail=.16*opening
    elif name=='peck':
        jab=gate(t,.08,.21,.25,.43)+.85*gate(t,.51,.67,.70,.91)
        neck+=.70*jab
        head+=.86*jab
        shift.x+=.058*jab
        shift.z-=.016*jab
        crest-=.25*jab
        jaw=.20*gate(t,.15,.21,.23,.29)
    elif name=='eat_fruit':
        bend=gate(t,.03,.19,.30,.47)
        swallow=gate(t,.48,.60,.73,.94)
        neck+=.36*bend-.37*swallow
        head+=.48*bend-.34*swallow
        jaw+=.38*gate(t,.14,.27,.30,.45)+.16*max(0,sin(4*t))*gate(t,.38,.48,.74,.95)
        crest+=.23*swallow
        tail-=.13*swallow
    elif name=='drink':
        bow=gate(t,.03,.27,.75,.99)
        neck+=.57*bow
        head+=.72*bow
        shift.x+=.051*bow
        jaw+=.16*bow*max(0,sin(5*t))
        tail+=.16*bow
    elif name=='alert':
        rise=gate(t,.03,.15,.75,.99)
        neck-=.29*rise
        look+=.63*gate(t,.16,.34,.51,.73)
        head-=.16*rise
        crest-=.30*rise
        fan+=.24*rise
    elif name=='perch':
        grip=.56+.13*sin(t+.12)
        shift.z-=.015
        face=gate(t,.12,.38,.58,.82)
        look+=.42*face
        tail+=.09
        crest+=.13*sin(t-.17)
    elif name in ('rest','death'):
        fall=ease((t-.12)/.76) if name=='death' else 1.
        shift.z-=.071*fall
        pitch+=.09*fall
        neck+=.24*fall
        head+=.30*fall
        opening=.35*fall if name=='death' else 0.
        tail-=.15*fall
        if name=='death':
            roll=1.54*fall
            look+=.25*fall
            jaw+=.25*fall
    elif name=='hit_react':
        recoil=gate(t,0,.16,.29,.78)
        shift.x-=.044*recoil
        pitch-=.21*recoil
        look+=.36*recoil
        opening=.39*recoil
        crest-=.31*recoil
    axes={'neck':[(Y,neck)],'head':[(Y,head),(Z,look)],
          'jaw':[(Y,jaw)],'tail':[(Y,tail)],'tail_fan':[(Y,fan),(X,.05*sin(t))],
          'crest':[(Y,crest)]}
    for side,sign in (('L',1),('R',-1)):
        flap=sin(flap_phase+(.045 if side=='R' else 0))*flap_amp
        axes[f'wing.{side}.upper']=[(X,sign*(flap+.22*opening)),(Z,-sign*opening*1.11)]
        axes[f'wing.{side}.lower']=[(Z,-sign*.32*opening),(X,sign*flap*.28)]
        axes[f'wing.{side}.tip']=[(Z,-sign*.10*opening),(X,sign*(.31*flap-.14*opening))]
        for j in (-1,0,1,2):
            axes[f'digit.{side}.{j}']=[(Y,(grip+.65*air)*(1 if j!=2 else -1))]
    if air:
        foot=[(-.032*air,.11*air,.75*air),(-.037*air,.095*air,.73*air)]
    return shift,pitch,roll,yaw,axes,foot,air

def lizard_pose(name,t):
    shift=Vector((.005*sin(t-.1),.003*sin(t),.003*sin(t+.18)))
    pitch=.019*sin(t+.19)
    roll=.016*sin(t-.12)
    yaw=0.
    neck=.034*sin(t+.05)
    head=.029*sin(t-.06)
    turn=.054*sin(t)
    chin=.024*max(0,sin(t))
    chest=.032*sin(t-.2)
    tail=[.065*sin(t-i*.13) for i in range(5)]
    lift=[.023*sin(t-.10-i*.11) for i in range(5)]
    foot=[(0.,0.,0.)]*4
    if name in ('walk','scurry','retreat','hide','turn'):
        fast=name in ('scurry','retreat')
        duty,stride,lift_leg=(.53,.085,.045) if fast else (.66,.046,.033)
        amount=gate(t,.01,.25,.60,.99) if name in ('retreat','hide','turn') else 1.
        direction=-1 if name in ('retreat','hide') else 1
        cadence=t*(2.3 if name=='retreat' else 1.48 if name=='hide' else 1.)
        phases=(.00,.50,.50,.00) if fast else (.15,.65,.88,.38)
        foot=[]
        for phase in phases:
            x,z,angle=step(cadence+phase,duty,stride*amount,lift_leg*amount)
            foot.append((direction*x,z,angle*direction))
        shift.y+=.020*sin(cadence)*amount
        shift.z+=.008*(1+cos(cadence*2))*amount
        yaw+=.11*sin(cadence-.1)*amount
        chest+=.085*sin(cadence+.11)*amount
        turn-=.16*sin(cadence-.05)*amount
        tail=[(.15 if fast else .10)*sin(cadence-i*.12)*amount for i in range(5)]
        if name=='hide':
            crouch=gate(t,.34,.60,.89,1)
            shift.z-=.058*crouch
            shift.x-=.045*crouch
            head+=.29*crouch
        if name=='turn':
            yaw+=.46*amount
            turn+=.42*amount
            roll-=.095*amount
    elif name in ('bask','rest'):
        shift.z-=.040 if name=='bask' else .052
        neck-=.22 if name=='bask' else 0.
        head-=.21 if name=='bask' else -.28
        chest+=.04
        tail=[.09+.027*sin(t-i*.11) for i in range(5)]
        lift=[.064]*5
    elif name in ('forage','drink'):
        reach=gate(t,.06,.30,.70,.98)
        chin+=reach*.20*max(0,sin(t*(5 if name=='drink' else 3.6)))
        turn+=.32*sin(t*2-.16)*reach if name=='forage' else 0
        neck+=.36*reach
        head+=.40*reach
        shift.x+=.058*reach
        shift.z-=.022*reach
        tail[0]+=.14*reach
        foot[0]=(.043*reach,.045*gate(t,.04,.12,.14,.24),0)
    elif name=='head_tilt':
        inspect=gate(t,.03,.27,.64,.98)
        turn-=.41*inspect
        neck-=.17*inspect
        head-=.12*inspect
        roll=.089*inspect
    elif name in ('tail_whip','threat'):
        brace=gate(t,.02,.23,.46,.76)
        release=gate(t,.30,.46,.53,.82) if name=='tail_whip' else 0.
        shift.y-=.050*brace
        shift.x+=.034*brace
        roll=-.15*brace+.14*release
        yaw=-.18*brace+.32*release
        chest-=.23*brace
        neck-=.24*brace
        head-=.20*brace
        chin+=.51*brace if name=='threat' else .11*release
        turn-=.31*brace
        for i in range(5):
            charge=gate(t,.08+i*.012,.26+i*.013,.35+i*.02,.48+i*.017)
            strike=gate(t,.33+i*.033,.46+i*.038,.52+i*.033,.77+i*.027)
            tail[i]+=(.55*charge-.80*strike)*(1-.12*i) if name=='tail_whip' else .30*brace*sin(t*1.2-i*.12)
            lift[i]+=.114*(charge+strike)
        foot[1]=(-.04*brace,.036*gate(t,.03,.10,.12,.22),0)
    elif name=='hit_react':
        shock=gate(t,0,.14,.28,.77)
        shift.x-=.064*shock
        roll=.24*shock
        turn=-.38*shock
        tail=[.34*shock*sin(t-i*.12) for i in range(5)]
    elif name=='death':
        drop=ease((t-.10)/.83)
        shift.z-=.066*drop
        roll=1.49*drop
        pitch+=.18*drop
        chin+=.31*drop
        neck+=.22*drop
        head+=.29*drop
        tail=[-.23*drop*(1-.14*i) for i in range(5)]
    axes={'chest':[(Z,chest)],'neck':[(Y,neck)],'head':[(Y,head),(Z,turn)],'jaw':[(Y,chin)]}
    for i in range(5):
        axes['tail.'+str(i)]=[(Z,tail[i]),(Y,lift[i])]
    return shift,pitch,roll,yaw,axes,foot,0.

def rotate_bone(bone,delta):
    q=bone.bone.matrix_local.to_quaternion()
    bone.rotation_quaternion=q.inverted()@delta@q

def aim_leg(bones,name,rest,target,root,pivot,shift,angle):
    a,b,c,_=rest
    hip=pivot+root@(a-pivot)+shift
    aim=target-hip
    direction=aim.normalized()
    length1,length2=(b-a).length,(c-b).length
    span=max(abs(length1-length2)+.001,min(length1+length2-.001,aim.length))
    run=(length1**2-length2**2+span**2)/(2*span)
    bend=math.sqrt(max(0,length1**2-run**2))
    line=(c-a).normalized()
    side=root@((b-a)-line*(b-a).dot(line))
    side=(side-direction*side.dot(direction)).normalized()
    knee=hip+direction*run+side*bend
    ankle=hip+direction*span
    base=root.inverted()
    upper=(b-a).rotation_difference(base@(knee-hip))
    lower=(c-b).rotation_difference(upper.inverted()@base@(ankle-knee))
    footing=(root@upper@lower).inverted()@Quaternion(Y,angle)
    for label,q in zip(('upper','lower','foot'),(upper,lower,footing),strict=True):
        rotate_bone(bones[name+'.'+label],q)

def animate(arm,mesh,legs,species):
    import bpy
    bird=species=='frutavil'
    bones=arm.pose.bones
    root=bones['root']
    pivot=root.bone.head_local.copy()
    world_to_root=root.bone.matrix_local.to_quaternion().inverted()
    scene=bpy.context.scene
    scene.frame_end=120
    for bone in bones:
        bone.rotation_mode='QUATERNION'
    clips=FRUTAVIL if bird else CROMATIL
    data=arm.animation_data_create()
    order=('leg.L','leg.R') if bird else ('fore.L','fore.R','hind.L','hind.R')
    for i,(name,sec) in enumerate(clips.items()):
        action=bpy.data.actions.new(name)
        data.action=action
        length=2*round(sec*15)
        for frame in sorted(set(range(0,length,2))|{length}):
            scene.frame_set(frame)
            t=frame/length
            shift,pitch,roll,yaw,axes,feet,air=(bird_pose if bird else lizard_pose)(name,t)
            rotation=Quaternion(Z,yaw)@Quaternion(X,roll)@Quaternion(Y,pitch)
            root.location=world_to_root@shift
            rotate_bone(root,rotation)
            for leg,(dx,dz,paw_angle) in zip(order,feet,strict=True):
                rest=legs[leg]
                anchor=rest[2]
                target=anchor+Vector((dx,0,dz))
                if air:
                    target.z+=shift.z*air
                if name=='death':
                    fall=ease((t-.15)/.78)
                    target=target.lerp(pivot+rotation@(target-pivot)+shift,fall)
                aim_leg(bones,leg,rest,target,rotation,pivot,shift,paw_angle)
            for label,angles in axes.items():
                q=Quaternion()
                for axis,amount in angles:
                    q @= Quaternion(axis,amount)
                rotate_bone(bones[label],q)
            bpy.context.view_layer.update()
            evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
            low=min((evaluated.matrix_world@p.co).z for p in evaluated.data.vertices)
            maintain_plane=name in ('rest','death','bask','perch')
            if low<.0015 or maintain_plane:
                root.location += world_to_root@Vector((0,0,.0015-low))
            for b in bones:
                b.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=b.name)
            root.keyframe_insert(data_path='location',frame=frame,group=root.name)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation='LINEAR'
        data.action=None
        track=data.nla_tracks.new()
        track.name=name
        track.strips.new(name,6+i*148,action)
        track.strips[0].extrapolation='NOTHING'
    for b in bones:
        b.rotation_quaternion.identity()
        b.location.zero()

