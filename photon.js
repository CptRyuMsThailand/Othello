class vec2{
	constructor(x,y){
		this.x = x;
		this.y = y;
	}
	static dot(a,b){
		return a.x*b.x+a.y*b.y;
	}
	static add(a,b){
		return new vec2(a.x+b.x,a.y+b.y);
	}
	static sub(a,b){
		return new vec2(a.x-b.x,a.y-b.y);
	}
	static scale(a,s){
		return new vec2(a.x*s,a.y*s);
	}
	static mul(a,b){
		return new vec2(a.x*b.x,a.y*b.y);
	}
	length2(){
		return vec2.dot(this,this);
	}
	length(){
		return Math.sqrt(this.length2());
	}
	normalize(){
		return vec2.scale(this,1/this.length());
	}
}
class Random{
	constructor(seed=1){
		this.seed = seed;
	}

	random(){
		return (this.seed = (this.seed * 1664525 + 1013904223)%(2**32))/2**32;
	}

}
let rngEngine = new Random();
class Scene{
	constructor(W,H){
		this.objectArr = [];
		this.lightArr = [];
		this.borderArr = [
			new lineObj(new vec2(-10,0),new vec2(W+10,0),sampleMirror),
			new lineObj(new vec2(W,-10),new vec2(W,H+10),sampleMirror),
			new lineObj(new vec2(W+10,H),new vec2(-10,H),sampleMirror),
			new lineObj(new vec2(0,H+10),new vec2(0,-10),sampleMirror)
			
		];
	}
	addObject(obj){
		this.objectArr.push(obj);
	}
	addLight(obj){
		this.lightArr.push(obj);
	}
	trace(ro,rd,nt=10000){
		let t = nt;
		let it = -1;
		let no;
		for(let i=0,len=this.objectArr.length;i<len;i++){
			let res = this.objectArr[i].trace(ro,rd);
			if(res[0] >= 1e-4 && res[0] < t){
				t = res[0];
				no = res[1];
				it = i;
			}
		}
		return [it,t,no];
	}
	border(ro,rd){
		let t = Infinity;
		let it = -1;

		for(let i=0;i<4;i++){
			let res = this.borderArr[i].trace(ro,rd);
			if(res[0] >= 0 && res[0] < t){
				t = res[0];

				it = i;
			}
		}
		return [it,t];
	}
	normal(ro,rd,t,i){
		return this.objectArr[i].normal(ro,rd,t);
	}
	sampleBRDF(pos,i,channel){
		return this.objectArr[i].brdfFnc(pos,
			sellmeierEquation([1.03961212,0.231792344,1.01046945],[6.0006*10**(-3),2.0017*10**(-2),103.56],channel)
			);
	}
	sampleLight(i,channel){
		return this.lightArr[i].sample(channel);
	}
}
class basicLight{
	constructor(color){
		this.color = color;
	}
	sample(){
		throw "Must implement";
	}
}
class pointLight extends basicLight{
	constructor(pos,color){
		super(color);
		this.pos = pos;
	}
	sample(channel){
		let xi = rngEngine.random()*2-1;
		return [
			new vec2(this.pos.x,this.pos.y),
			new vec2(Math.cos(xi*Math.PI),Math.sin(xi*Math.PI))
		];
	}
}
class planeLight extends basicLight{
	constructor(pos1,pos2,color){
		super(color);
		this.pos1 = pos1;
		this.pos2 = pos2;
		let d = vec2.sub(pos1,pos2);
		this.nor = (new vec2(-d.y,d.x)).normalize();
	}
	sample(channel){
		let xi = Math.random();
		return [
			vec2.add(vec2.scale(this.pos1,1-xi),vec2.scale(this.pos2,xi)),
			new vec2(this.nor.x,this.nor.y)
		];
	}
}
class basicObject{
	constructor(brdfFnc){
		this.brdfFnc = brdfFnc;
	}
	trace(){
		throw "Must implement";
	}
	normal(){
		throw "Must implement";
	}
}
class lineObj extends basicObject{
	constructor(pa,pb,brdfFnc){
		super(brdfFnc);
		this.pa = pa;
		this.pb = pb;
	}
	trace(ro,rd){
		let sT = vec2.sub(this.pb,this.pa);
		let sN = new vec2(-sT.y,sT.x);
		let t = vec2.dot(sN,vec2.sub(this.pa,ro))/vec2.dot(sN,rd);
		let u = vec2.dot(sT,vec2.sub(vec2.add(ro,vec2.scale(rd,t)),this.pa));
		if(t < 1e-3 || u < 0 || u > vec2.dot(sT,sT)){
			return [-1];
		}
		return [t,sN.normalize()];
		
	}
	
}
class sphereObject extends basicObject{
	constructor(center,radius,brdfFnc){
		super(brdfFnc);
		this.center = center;
		this.radius = radius;
	}
	trace(ro,rd){
		let p = vec2.sub(ro,this.center);
		let B = vec2.dot(p,rd);
		let C = vec2.dot(p,p) - this.radius**2;
		let detSq = B*B-C;
		if(detSq >= 0){
			let det = Math.sqrt(detSq);
			let t = -B - det;
			if(t <= 1e-3 )
				t = -B + det;
			if(t > 1e-3)
				return [t,vec2.add(p,vec2.scale(rd,t)).normalize()];
			
		}
		return [-1];
	}
}

function sampleMirror(rd){
	return new vec2(-rd.x,rd.y);
}
function sampleDiffuse(rd){
	let xi = rngEngine.random();
	let sinT = 2*xi - 1;
	let cosT = Math.sqrt(1 - sinT*sinT);
	return new vec2(sinT,cosT*Math.sign(rd.y));
}
function sampleDielectric(rd,ior=1.5){
	let eta = rd.y < 0.0 ? ior : 1/ior;
	let fr =  fresnel(rd,Math.abs(eta));
	
	if(rngEngine.random() < fr){
		return new vec2(-rd.x,rd.y);
	}else{
		return new vec2(-rd.x*eta,
			Math.sqrt(1-eta*eta*rd.x*rd.x)*(-Math.sign(rd.y))
			).normalize();
	}
}
function fresnel(rd,ior){
	let cosi = Math.abs(Math.min(Math.max(rd.y,-1),1));
	
	let sint = ior*ior *(1-cosi*cosi);
	if(sint > 1){
		return 1;
	}else{
		let cost = Math.sqrt(Math.max(0,1-sint));
		let Rs = ((ior * cosi) - cost)/((ior * cosi) + (cost));
		let Rp = ((ior * cost) - cosi)/((ior * cost) + (cosi));
		return (Rs * Rs + Rp * Rp)/2;
	}
}

function sellmeierEquation(B,C,lambda){
	lambda = 400+(700-400)*lambda;
	lambda2 = (lambda*1e-3)*(lambda*1e-3);
	return Math.sqrt(
		1+(lambda2*B[0])/(lambda2-C[0])+
		(lambda2*B[1])/(lambda2-C[1])+
		(lambda2*B[2])/(lambda2-C[2])
		);

}
