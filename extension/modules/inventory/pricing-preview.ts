/** Shared preview: interpolation for control points, horizontal segments for step rules. */
namespace AESPricingPreview {
    export function mount(container:JQuery) {
        const chart=document.createElementNS('http://www.w3.org/2000/svg','svg');
        chart.setAttribute('viewBox','0 0 440 240');chart.setAttribute('role','img');
        chart.setAttribute('aria-label',AESI18n.t('Pricing curve preview'));chart.classList.add('aes-curve-preview');
        container.append(chart);
        function svg(tag:string,attrs:Record<string,string>,text?:string) {
            const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
            for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
            if(text!==undefined)node.textContent=text;
            chart.append(node);return node;
        }
        function draw(points:AESModel.PricingPoint[] | null,steps?:AESModel.PricingStep[]) {
            chart.replaceChildren();chart.style.visibility=points ? '' : 'hidden';if(!points)return;
            const scale=Math.max(1,...points.map(point=>Math.abs(point.change)));
            const x=(load:number)=>48+load*3.5,y=(change:number)=>110-change/scale*70;
            for(const tick of [-1,0,1]) {
                const yy=String(y(tick*scale));
                svg('line',{x1:'48',x2:'398',y1:yy,y2:yy,stroke:'currentColor','stroke-opacity':tick===0?'.45':'.15'});
                svg('text',{x:'40',y:String(Number(yy)+4),'text-anchor':'end'},String(Number((tick*scale).toFixed(2))));
            }
            for(const tick of [0,25,50,75,100])svg('text',{x:String(x(tick)),y:'205','text-anchor':'middle'},tick+'%');
            svg('text',{x:'220',y:'231','text-anchor':'middle'},AESI18n.t('Load (%)'));
            if(steps){
                steps.forEach((step,index)=>{
                    svg('line',{x1:String(x(step.min)),x2:String(x(step.max)),y1:String(y(step.step)),y2:String(y(step.step)),stroke:'currentColor','stroke-width':'2.5'});
                    if(index>0)svg('line',{x1:String(x(step.min)),x2:String(x(step.min)),y1:String(y(steps[index-1].step)),y2:String(y(step.step)),stroke:'currentColor','stroke-dasharray':'3 4','stroke-opacity':'.4'});
                    svg('circle',{cx:String(x(step.min)),cy:String(y(step.step)),r:'3',fill:index?'none':'currentColor',stroke:'currentColor','stroke-width':'1.5'});
                    svg('circle',{cx:String(x(step.max)),cy:String(y(step.step)),r:'3',fill:'currentColor'});
                });
            }else{
                svg('polyline',{points:points.map(point=>`${x(point.load)},${y(point.change)}`).join(' '),fill:'none',stroke:'currentColor','stroke-width':'2.5'});
                for(const point of points)svg('circle',{cx:String(x(point.load)),cy:String(y(point.change)),r:'3',fill:'currentColor'});
            }
        }
        return {
            curve:(points:AESModel.PricingPoint[] | null)=>draw(points),
            steps:(steps:AESModel.PricingStep[])=>{
                const valid=steps.length>0 && steps[0].min===0 && steps[steps.length-1].max===100 && steps.every((step,i)=>[step.min,step.max,step.step].every(Number.isInteger) && step.min>=0 && step.max<=100 && step.min<step.max && (!i || step.min===steps[i-1].max));
                draw(valid ? steps.flatMap(step=>[{load:step.min,change:step.step},{load:step.max,change:step.step}]) : null,steps);
                return valid;
            }
        };
    }
}
