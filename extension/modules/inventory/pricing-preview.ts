/** Shared preview: interpolation for control points, horizontal segments for step rules. */
namespace AESPricingPreview {
    export function mount(container:JQuery) {
        const chart=document.createElementNS('http://www.w3.org/2000/svg','svg');
        chart.setAttribute('viewBox','0 0 440 240');chart.setAttribute('role','slider');
        chart.setAttribute('tabindex','0');chart.setAttribute('aria-valuemin','0');chart.setAttribute('aria-valuemax','100');
        chart.setAttribute('aria-label',AESI18n.t('Pricing curve preview'));chart.classList.add('aes-curve-preview');
        const readout=document.createElement('div');readout.className='aes-pricing-readout';
        container.append(chart,readout);
        let inspect:((load:number)=>void) | undefined,selectedLoad=50;
        chart.addEventListener('pointermove',event=>{
            const matrix=chart.getScreenCTM();if(!matrix || !inspect)return;
            const point=chart.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
            const local=point.matrixTransform(matrix.inverse());
            inspect(Math.max(0,Math.min(100,(local.x-48)/3.5)));
        });
        chart.addEventListener('focus',()=>inspect?.(selectedLoad));
        chart.addEventListener('keydown',event=>{
            const changes:Record<string,number>={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1};
            if(event.key==='Home' || event.key==='End' || event.key in changes){
                event.preventDefault();inspect?.(event.key==='Home'?0:event.key==='End'?100:Math.max(0,Math.min(100,selectedLoad+changes[event.key])));
            }
        });
        function svg(tag:string,attrs:Record<string,string>,text?:string) {
            const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
            for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
            if(text!==undefined)node.textContent=text;
            chart.append(node);return node;
        }
        function draw(points:AESModel.PricingPoint[] | null,steps?:AESModel.PricingStep[]) {
            chart.replaceChildren();readout.textContent='';inspect=undefined;chart.style.visibility=points ? '' : 'hidden';if(!points)return;
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
            const cursor=svg('line',{y1:'40',y2:'180',stroke:'currentColor','stroke-dasharray':'3 3','stroke-opacity':'.5'});
            const marker=svg('circle',{r:'5',fill:'currentColor'});
            inspect=(load:number)=>{
                selectedLoad=load;
                const change=steps ? steps.find(step=>step.min<=Math.round(load) && Math.round(load)<=step.max)!.step : AESPricingCurve.interpolate(points,load);
                const loadText=String(Number(load.toFixed(2))),changeText=(change>0?'+':'')+String(Number(change.toFixed(2)));
                const text=AESI18n.t('Load (%)')+': '+loadText+' · '+AESI18n.t('Change (pp)')+': '+changeText;
                readout.textContent=text;chart.setAttribute('aria-valuenow',loadText);chart.setAttribute('aria-valuetext',text);
                cursor.setAttribute('x1',String(x(load)));cursor.setAttribute('x2',String(x(load)));
                marker.setAttribute('cx',String(x(load)));marker.setAttribute('cy',String(y(change)));
            };
            inspect(selectedLoad);
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
