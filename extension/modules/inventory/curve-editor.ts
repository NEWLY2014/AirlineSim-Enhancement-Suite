/** Editable numeric controls are the accessible alternative to the curve preview. */
namespace AESCurveEditor {
    export function mount(container:JQuery, initial:unknown) {
        const defaults=[{load:0,change:-15},{load:60,change:-5},{load:85,change:0},{load:95,change:3},{load:100,change:6}];
        const table=$(AESI18n.html('<table class="table table-bordered aes-curve-table"><thead><tr><th>Load (%)</th><th>Change (default-price percentage points)</th><th></th></tr></thead><tbody></tbody></table>'));
        const body=table.find('tbody');
        const add=$('<button type="button" class="btn btn-default"></button>').text(AESI18n.t('Add control point'));
        const error=$('<p class="warning" role="status"></p>');
        const chart=document.createElementNS('http://www.w3.org/2000/svg','svg');
        chart.setAttribute('viewBox','0 0 440 220');chart.setAttribute('role','img');chart.setAttribute('aria-label',AESI18n.t('Pricing curve preview'));chart.classList.add('aes-curve-preview');
        container.append(table,add,error,chart,$('<p></p>').text(AESI18n.t('Adjustments use the default price. Only the final ticket price is rounded.')));
        function raw() {
            return body.children('tr').toArray().map(row=>{
                const inputs=$(row).find('input');
                const number=(index:number)=>String(inputs.eq(index).val()).trim()==='' ? NaN : Number(inputs.eq(index).val());
                return {load:number(0),change:number(1)};
            });
        }
        function read() { return AESPricingCurve.points(raw()); }
        function row(point:AESModel.PricingPoint, endpoint=false) {
            const tr=$('<tr></tr>');
            const load=$('<input type="number" min="0" max="100" step="any" class="form-control">').val(point.load).prop('readOnly',endpoint).attr('aria-label',AESI18n.t('Load (%)'));
            const change=$('<input type="number" step="any" class="form-control">').val(point.change).attr('aria-label',AESI18n.t('Change (default-price percentage points)'));
            const remove=$('<button type="button" class="btn btn-default"></button>').text(AESI18n.t('Delete row')).prop('disabled',endpoint);
            remove.on('click',()=>{tr.remove();preview();add.trigger('focus');});
            tr.append($('<td></td>').append(load),$('<td></td>').append(change),$('<td></td>').append(remove));body.append(tr);
        }
        function svg(tag:string, attributes:Record<string,string>, text?:string) {
            const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
            for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
            if(text!==undefined)node.textContent=text;
            chart.append(node);return node;
        }
        function preview() {
            const points=read();chart.replaceChildren();
            error.text(points ? '' : AESI18n.t('Use distinct loads from 0 to 100, with both endpoints and finite adjustments.'));
            chart.style.display=points ? '' : 'none';
            if(!points)return;
            const scale=Math.max(1,...points.map(point=>Math.abs(point.change)));
            const x=(load:number)=>40+load*3.6,y=(change:number)=>100-change/scale*70;
            svg('line',{x1:'40',x2:'400',y1:'100',y2:'100',stroke:'currentColor','stroke-opacity':'.35'});
            svg('line',{x1:'40',x2:'40',y1:'25',y2:'175',stroke:'currentColor','stroke-opacity':'.35'});
            svg('polyline',{points:points.map(point=>`${x(point.load)},${y(point.change)}`).join(' '),fill:'none',stroke:'currentColor','stroke-width':'2'});
            for(const point of points)svg('circle',{cx:String(x(point.load)),cy:String(y(point.change)),r:'3',fill:'currentColor'});
            svg('text',{x:'5',y:'34'},String(Number(scale.toFixed(2))));
            svg('text',{x:'5',y:'104'},'0');
            svg('text',{x:'5',y:'174'},String(Number((-scale).toFixed(2))));
            svg('text',{x:'40',y:'195'},'0%');svg('text',{x:'365',y:'195'},'100%');
            svg('text',{x:'220',y:'215','text-anchor':'middle'},AESI18n.t('Load (%)'));
        }
        function sort() {
            body.append(...body.children('tr').toArray().sort((a,b)=>Number($(a).find('input').first().val())-Number($(b).find('input').first().val())));
        }
        const starting=Array.isArray(initial) && initial.length ? initial : defaults;
        starting.forEach((point,i)=>{
            const load=typeof point?.load === 'number' ? point.load : NaN;
            const change=typeof point?.change === 'number' ? point.change : NaN;
            row({load,change},(i===0 && load===0) || (i===starting.length-1 && load===100));
        });
        body.on('input','input',preview);
        body.on('change','input',()=>{if(read())sort();preview();});
        add.on('click',()=>{
            const points=read();
            if(!points){row({load:50,change:0});preview();body.children().last().find('input').first().trigger('focus');return;}
            let index=1;
            for(let i=2;i<points.length;i++)if(points[i].load-points[i-1].load>points[index].load-points[index-1].load)index=i;
            const load=(points[index-1].load+points[index].load)/2;
            row({load,change:AESPricingCurve.interpolate(points,load)});const input=body.children().last().find('input').first();sort();preview();input.trigger('focus');
        });
        preview();return {read,raw};
    }
}
