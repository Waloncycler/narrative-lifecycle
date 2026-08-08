#!/usr/bin/env python3
import qrcode, textwrap, os
from PIL import Image, ImageDraw, ImageFont

BG_DARK=(10,12,20); BG_CARD=(16,20,36); BG_CARD2=(20,26,46)
ACCENT_BLUE=(59,130,246); ACCENT_CYAN=(34,211,238); ACCENT_GOLD=(251,191,36)
ACCENT_GLOW=(99,102,241); TEXT_WHITE=(255,255,255); TEXT_SILVER=(200,210,230)
TEXT_GRAY=(130,145,170); TEXT_DIM=(80,95,120); GREEN_OK=(52,211,153)
RED_RISK=(239,68,68); DIVIDER=(30,40,65)

W=1200; PADDING=72

def load_font(size):
    for p in ["/System/Library/Fonts/STHeiti Medium.ttc","/System/Library/Fonts/Hiragino Sans GB.ttc","/System/Library/Fonts/PingFang.ttc",
              "/System/Library/Fonts/Arial.ttf","/Library/Fonts/Arial.ttf"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

def grad(draw,x0,y0,x1,y1,ct,cb):
    steps=y1-y0
    for i in range(steps):
        t=i/max(steps-1,1)
        r=int(ct[0]*(1-t)+cb[0]*t); g=int(ct[1]*(1-t)+cb[1]*t); b=int(ct[2]*(1-t)+cb[2]*t)
        draw.line([(x0,y0+i),(x1,y0+i)],fill=(r,g,b))

def rr(draw,x0,y0,x1,y1,radius,fill,outline=None,ow=2):
    draw.rounded_rectangle([x0,y0,x1,y1],radius=radius,fill=fill,outline=outline,width=ow)

def mt(draw,text,font):
    b=draw.textbbox((0,0),text,font=font); return b[2]-b[0],b[3]-b[1]

def wt(draw,text,font,maxw):
    words=text.split(' '); lines=[]; cur=''
    for w in words:
        t=cur+(' ' if cur else '')+w
        if mt(draw,t,font)[0]<=maxw: cur=t
        else:
            if cur: lines.append(cur)
            cur=w
    if cur: lines.append(cur)
    return lines

def badge(draw,x,y,text,bg,fg,font):
    b=font.getbbox(text); tw,th=b[2]-b[0],b[3]-b[1]; px,py=18,8
    rr(draw,x,y,x+tw+px*2,y+th+py*2,12,bg)
    draw.text((x+px,y+py),text,font=font,fill=fg)
    return tw+px*2+12

def build():
    fh=load_font(52); fhs=load_font(26); ft=load_font(36); fs=load_font(22)
    fb=load_font(19); fsm=load_font(16); fxs=load_font(13); fbg=load_font(15)
    ftg=load_font(17)

    qr=qrcode.QRCode(version=3,error_correction=qrcode.constants.ERROR_CORRECT_H,box_size=9,border=2)
    qr.add_data("https://github.com/Waloncycler/narrative-lifecycle"); qr.make(fit=True)
    qri=qr.make_image(fill_color=(10,12,20),back_color=(255,255,255)).convert("RGBA")
    QRS=260; qri=qri.resize((QRS,QRS),Image.LANCZOS)

    inner_w=W-PADDING*2; sg=44; cr=18
    stages=[
        ("S0","潜伏信号","零散弱事实·无市场语言","前瞻建观察池·低成本埋伏",(80,95,120)),
        ("S1","注意力唤醒","权威触发·搜索/成交异动","信息发现Alpha·速度优势",(59,130,246)),
        ("S2","叙事假说","解释涌现·探索方向意义","认知建构Alpha·胜率跃升",(99,102,241)),
        ("S3","标签收敛","压缩为极简词汇与股票池","主题投资Alpha·主线确立",(168,85,247)),
        ("S4","共识测试","龙头领涨·产业链有序扩散","交易型Alpha·弹性黄金期",(251,191,36)),
        ("S5","定价采纳","机构研报重构盈利/估值","中期趋势Alpha·机构加仓",(251,146,60)),
        ("S6","现实验证","订单/财报/排产闭环兑现","预期差Alpha·超预期捕捉",(52,211,153)),
        ("S7","演化分岔","主流化/衰退/再叙事化","生命周期管理·精准逃顶",(239,68,68)),
    ]
    principles=[
        ("名 Perception","弱信号如何完成标签化与认知收敛",ACCENT_BLUE),
        ("资 Capital","认知打开机构系统性配置的大门",ACCENT_GOLD),
        ("实 Reality","订单、财报、产业链物理证据闭合",GREEN_OK),
        ("势 Evolution","名→资→实→势 自增强涌现闭环",ACCENT_GLOW),
    ]
    alpha_zones=[
        ("S0-S1","观察期","低成本前瞻布局",TEXT_GRAY,BG_CARD),
        ("S2-S3","爆发期","主升浪黄金入场",ACCENT_GOLD,(30,28,16)),
        ("S4-S5","趋势期","机构配置顺势跟随",ACCENT_CYAN,(14,28,38)),
        ("S6-S7","兑现期","预期差超预期/精准退出",GREEN_OK,(14,30,22)),
    ]

    EH=5600
    img=Image.new("RGB",(W,EH),BG_DARK)
    draw=ImageDraw.Draw(img)
    grad(draw,0,0,W,EH,(10,12,25),(5,8,18))

    y=0
    # HERO
    hero_h=360
    grad(draw,0,0,W,hero_h,(18,24,52),(10,14,32))
    draw.rectangle([0,0,W,5],fill=ACCENT_BLUE)

    t1="市场叙事生命周期研究系统"; tw,_=mt(draw,t1,fh)
    draw.text(((W-tw)//2,48),t1,font=fh,fill=TEXT_WHITE)
    t2="Narrative Lifecycle Research System"; tw2,_=mt(draw,t2,fhs)
    draw.text(((W-tw2)//2,118),t2,font=fhs,fill=ACCENT_CYAN)
    tg="「 Evidence first.   Rules second.   LLM explanation third. 」"; tgw,_=mt(draw,tg,fs)
    draw.text(((W-tgw)//2,168),tg,font=fs,fill=TEXT_SILVER)

    bx=PADDING; by=224
    for lbl,bg,fg in [("MIT License",ACCENT_BLUE,TEXT_WHITE),("Node.js>=20",(22,101,52),(187,247,208)),
                      ("v0.13 Stable",(99,102,241),TEXT_WHITE),("390+ Tests",(180,60,10),TEXT_WHITE),
                      ("43+ Sources",(6,95,70),(110,231,183)),("Open Source",(20,83,45),(134,239,172))]:
        bx+=badge(draw,bx,by,lbl,bg,fg,fbg)+10

    m1="二级市场交易的不是事实本身，而是共同认知状态跃迁的概率密度"
    m1w,_=mt(draw,m1,fsm); draw.text(((W-m1w)//2,282),m1,font=fsm,fill=TEXT_GRAY)
    m2="以及这种跃迁能否引爆资本重配与现实验证的正反馈之「势」"
    m2w,_=mt(draw,m2,fsm); draw.text(((W-m2w)//2,306),m2,font=fsm,fill=TEXT_GRAY)
    y=hero_h+sg

    # WHY
    rr(draw,PADDING,y,W-PADDING,y+195,cr,BG_CARD,ACCENT_BLUE,1)
    draw.text((PADDING+26,y+20),"① 为什么做这个项目",font=ft,fill=ACCENT_CYAN)
    for i,l in enumerate(["• 同样的订单，有时引爆翻倍主升，有时利好出尽——传统研究范式无法解释这种非对称",
                           "• 热度分析只看表象，无法区分「一次性情绪消耗」与「具有产业外推力的真正叙事结构」",
                           "• 黑盒大模型盲打分：缺乏因果证据链，幻觉严重，无法积累可复盘的认知资产",
                           "• 本系统构建严密透明的 Narrative State Change Detector，追踪P(Sᵢ→Sᵢ₊₁)的量化动力"]):
        draw.text((PADDING+26,y+72+i*30),l,font=fb,fill=TEXT_SILVER)
    y+=195+sg

    # 名资实势
    draw.text((PADDING,y),"② 名·资·实·势 认知演化闭环",font=ft,fill=TEXT_WHITE); y+=50
    cw=(inner_w-36)//4
    for i,(lbl,desc,color) in enumerate(principles):
        cx=PADDING+i*(cw+12)
        rr(draw,cx,y,cx+cw,y+138,14,BG_CARD2,color,2)
        draw.rectangle([cx,y,cx+cw,y+4],fill=color)
        lw,_=mt(draw,lbl,fs); draw.text((cx+(cw-lw)//2,y+16),lbl,font=fs,fill=color)
        for j,wl in enumerate(wt(draw,desc,fsm,cw-24)):
            draw.text((cx+12,y+58+j*22),wl,font=fsm,fill=TEXT_SILVER)
    y+=138+sg

    # S0-S7 flow
    draw.text((PADDING,y),"③ S0 → S7 状态跃迁机",font=ft,fill=TEXT_WHITE); y+=50
    flow_y=y+30; sw2=inner_w//8
    for i,(sid,cn,gate,alpha,color) in enumerate(stages):
        cx2=PADDING+i*sw2+sw2//2; rn=24
        draw.ellipse([cx2-rn,flow_y-rn,cx2+rn,flow_y+rn],fill=color,outline=TEXT_WHITE,width=2)
        sww,shh=mt(draw,sid,fbg); draw.text((cx2-sww//2,flow_y-shh//2),sid,font=fbg,fill=BG_DARK)
        cnw,_=mt(draw,cn,fxs); draw.text((cx2-cnw//2,flow_y+rn+5),cn,font=fxs,fill=color)
        if i<7:
            ax=cx2+rn+2; ex=cx2+sw2-rn-4
            draw.line([(ax,flow_y),(ex,flow_y)],fill=TEXT_DIM,width=2)
            draw.polygon([(ex,flow_y-5),(ex,flow_y+5),(ex+8,flow_y)],fill=TEXT_DIM)
    y=flow_y+72

    # Stage cards 4x2
    ch2=118; cols=4; scw=(inner_w-30)//cols
    for i,(sid,cn,gate,alpha,color) in enumerate(stages):
        row,col=divmod(i,cols)
        sx=PADDING+col*(scw+10); sy=y+row*(ch2+10)
        rr(draw,sx,sy,sx+scw,sy+ch2,14,BG_CARD2)
        draw.rectangle([sx,sy,sx+6,sy+ch2],fill=color)
        draw.text((sx+16,sy+10),f"{sid} · {cn}",font=ftg,fill=color)
        for j,gl in enumerate(wt(draw,f"门槛: {gate}",fxs,scw-26)):
            draw.text((sx+16,sy+44+j*18),gl,font=fxs,fill=TEXT_SILVER)
        for j,al in enumerate(wt(draw,f"Alpha: {alpha}",fxs,scw-26)):
            draw.text((sx+16,sy+82+j*18),al,font=fxs,fill=GREEN_OK)
    y+=2*(ch2+10)+sg

    # Equation
    rr(draw,PADDING,y,W-PADDING,y+195,cr,(12,18,40),ACCENT_GLOW,2)
    draw.text((PADDING+26,y+16),"④ 跃迁动力学方程  Transition Force Equation",font=fs,fill=ACCENT_GLOW)
    for ei,(line,color,fnt) in enumerate([
        ("P(Sᵢ→Sᵢ₊₁)  =  σ ( F_Driving  −  F_Friction  +  F_Feedback )",ACCENT_GOLD,fs),
        ("","",""),
        ("F_Driving   =  权威度 × 解释密度 × 标签清晰度 × 龙头强度 × 证据密度",TEXT_SILVER,fsm),
        ("F_Friction  =  估值透支 + 标的容量瓶颈 + 现实断层风险 + 政策合规阻力",TEXT_SILVER,fsm),
        ("F_Feedback =  Δ价格 × Δ注意力  +  资本流入 × 产业扩产反身性强度",TEXT_SILVER,fsm),
    ]):
        if not line: y+=8; continue
        if fnt: draw.text((PADDING+36,y+58+ei*30),line,font=fnt,fill=color)
    y+=195+sg

    # Alpha zones
    draw.text((PADDING,y),"⑤ Alpha 捕获区间策略矩阵",font=ft,fill=TEXT_WHITE); y+=50
    azw=(inner_w-30)//4
    for i,(sr,phase,strategy,color,bg2) in enumerate(alpha_zones):
        ax=PADDING+i*(azw+10); ah=114
        rr(draw,ax,y,ax+azw,y+ah,14,bg2,color,2)
        draw.rectangle([ax,y,ax+azw,y+4],fill=color)
        srw,_=mt(draw,sr,fs); draw.text((ax+(azw-srw)//2,y+12),sr,font=fs,fill=color)
        phw,_=mt(draw,phase,fbg); draw.text((ax+(azw-phw)//2,y+46),phase,font=fbg,fill=TEXT_WHITE)
        for j,sl in enumerate(wt(draw,strategy,fxs,azw-20)):
            slw,_=mt(draw,sl,fxs); draw.text((ax+(azw-slw)//2,y+76+j*18),sl,font=fxs,fill=TEXT_SILVER)
    y+=114+sg

    # Reflexivity
    rr(draw,PADDING,y,W-PADDING,y+120,cr,BG_CARD2,ACCENT_CYAN,1)
    draw.text((PADDING+26,y+14),"⑥ 反身性演化闭环  Reflexive Evolution Loop",font=fs,fill=ACCENT_CYAN)
    lp="名(Perception)→资(Capital)→实(Reality)→势(Evolution)→新一轮 S0"
    lpw,_=mt(draw,lp,fb); draw.text(((W-lpw)//2,y+58),lp,font=fb,fill=ACCENT_GOLD)
    lp2="S7A 主流化长期配置  |  S7B 透支衰退双杀  |  S7C 再叙事化裂变"
    lp2w,_=mt(draw,lp2,fsm); draw.text(((W-lp2w)//2,y+90),lp2,font=fsm,fill=TEXT_SILVER)
    y+=120+sg

    # Golden cases
    rr(draw,PADDING,y,W-PADDING,y+110,cr,BG_CARD,ACCENT_GOLD,1)
    draw.text((PADDING+26,y+14),"⑦ 金标准真实案例 Golden Cases",font=fs,fill=ACCENT_GOLD)
    for i,case in enumerate(["🧬 脑机接口 BCI — S0学术论文 → S4资本共识测试 全周期演化",
                              "🤖 人形机器人 — 概念发布 → 减速器/丝杠/传感器产业链大面积扩散",
                              "💊 创新药License-out — 海外临床 → 首付款 → 里程碑商业化现实验证"]):
        draw.text((PADDING+26,y+54+i*20),case,font=fsm,fill=TEXT_SILVER)
    y+=110+sg*2

    # FOOTER QR
    fh2=QRS+110
    grad(draw,0,y,W,y+fh2,(14,20,45),(8,12,30))
    draw.rectangle([0,y,W,y+3],fill=ACCENT_BLUE)

    lx,ly=PADDING,y+32
    draw.text((lx,ly),"扫码关注开源仓库",font=ft,fill=TEXT_WHITE)
    draw.text((lx,ly+46),"⭐ Star  ·  🍴 Fork  ·  🤝 PR Welcome",font=fb,fill=ACCENT_CYAN)
    draw.text((lx,ly+84),"github.com/Waloncycler/narrative-lifecycle",font=fb,fill=ACCENT_BLUE)
    draw.text((lx,ly+120),"MIT License  ·  Free & Open Source",font=fsm,fill=TEXT_GRAY)
    draw.text((lx,ly+148),"Evidence first.  Rules second.  LLM explanation third.",font=fsm,fill=TEXT_DIM)

    qt="「 致敬所有在喧嚣与泡沫中坚持寻找确定性的严肃研究者 」"
    qtw,_=mt(draw,qt,fsm); draw.text(((W-qtw)//2,y+fh2-30),qt,font=fsm,fill=TEXT_DIM)

    qrx=W-PADDING-QRS; qry=y+(fh2-QRS)//2-10
    draw.rectangle([qrx-14,qry-14,qrx+QRS+14,qry+QRS+14],fill=(255,255,255))
    img.paste(qri,(qrx,qry))
    qlb="GitHub Repo QR"; qlbw,_=mt(draw,qlb,fxs)
    draw.text((qrx+(QRS-qlbw)//2,qry+QRS+18),qlb,font=fxs,fill=TEXT_GRAY)

    y+=fh2
    draw.rectangle([0,y,W,y+5],fill=ACCENT_GLOW)
    y+=5

    img=img.crop((0,0,W,y))
    out="/Users/walox/Documents/narrative-lifecycle/narrative_lifecycle_share_card.png"
    img.save(out,"PNG",optimize=True)
    print(f"Saved: {out}  ({W}x{y}px)")
    return out

build()
