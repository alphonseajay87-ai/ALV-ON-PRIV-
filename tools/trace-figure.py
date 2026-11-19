# Traces tools/source/{front,back}.webp into vector tone layers (fig.json). Needs numpy, scipy, scikit-image, Pillow.
# js/figure.js is this output plus the opacity ramp (see FIG_OP). Source art lives in tools/source/.
import numpy as np, json, sys
from PIL import Image
from scipy import ndimage as ndi
from skimage import measure, morphology, filters
SRC=__import__('os').path.dirname(__file__)+'/source/'
LV=[16,34,54,76,100,126,156]          # tone thresholds (0-255 luminance)
def enc(rings, tol):
    out=[]
    for r in rings:
        p=measure.approximate_polygon(r,tol)
        if len(p)<4: continue
        pts=np.rint(p[:,::-1]).astype(int)  # x,y
        # drop duplicate consecutive points
        keep=[0]+[i for i in range(1,len(pts)) if (pts[i]!=pts[i-1]).any()]
        pts=pts[keep]
        if len(pts)<4: continue
        d=np.diff(pts,axis=0)
        out.append('M%d %dl%sz'%(pts[0][0],pts[0][1],' '.join('%d %d'%(a,b) for a,b in d)))
    return ''.join(out)
def area(r): 
    x,y=r[:,1],r[:,0]; return abs(np.dot(x,np.roll(y,1))-np.dot(y,np.roll(x,1)))/2
res={}
for side in ['front','back']:
    im=Image.open(SRC+side+'.webp').convert('L'); L=np.asarray(im,float); h,w=L.shape
    Ls=ndi.gaussian_filter(L,1.1)
    m=Ls>9
    m=morphology.binary_closing(m,morphology.disk(6))
    m=ndi.binary_fill_holes(m)
    lab,n=ndi.label(m); sizes=ndi.sum(m,lab,range(1,n+1)); m=lab==(1+int(np.argmax(sizes)))
    m=ndi.binary_fill_holes(morphology.binary_opening(m,morphology.disk(2)))
    Image.fromarray((m*255).astype('uint8')).save(f'mask_{side}.png')
    Lm=np.where(m,Ls,0.0); Lm=np.pad(Lm,1)
    mp=np.pad(m.astype(float),1)
    sil=[r-1 for r in measure.find_contours(ndi.gaussian_filter(mp,1.0),0.5) if area(r)>200]
    bands=[]
    for t in LV:
        rings=[r-1 for r in measure.find_contours(Lm,t) if area(r)>=22 or len(r)>40 and area(r)>8]
        bands.append(enc(rings,0.85))
    res[side]=dict(w=w,h=h,sil=enc(sil,0.9),bands=bands)
    print(side,[len(b)//1024 for b in bands],len(res[side]['sil'])//1024,'KB', 'mask%',round(m.mean()*100,1))
json.dump(res,open('fig.json','w'))
