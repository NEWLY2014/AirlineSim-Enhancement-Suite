/** Editable numeric controls are the accessible alternative to the curve preview. */
namespace AESCurveEditor {
    export function mount(container:JQuery, initial:unknown, previewContainer=container) {
        const defaults=AESPricingCurve.defaults();
        const table=$(AESI18n.html('<table class="table table-bordered aes-curve-table"><thead><tr><th>Load (%)</th><th>Change (pp)</th><th></th></tr></thead><tbody></tbody></table>'));
        const body=table.find('tbody');
        const add=$('<button type="button" class="btn btn-default"></button>').text(AESI18n.t('Add control point'));
        const error=$('<p class="warning" role="status"></p>');
        container.append(table,add,error);
        const chart=AESPricingPreview.mount(previewContainer);
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
            const remove=$('<button type="button" class="btn btn-default aes-pricing-delete"><span aria-hidden="true">×</span></button>').attr('aria-label',AESI18n.t('Delete row')).prop('disabled',endpoint);
            remove.on('click',()=>{tr.remove();preview();add.trigger('focus');});
            tr.append($('<td></td>').append(load),$('<td></td>').append(change),$('<td></td>').append(remove));body.append(tr);
        }
        function preview() {
            const points=read();
            error.text(points ? '' : AESI18n.t('Use distinct loads from 0 to 100, with both endpoints and finite adjustments.'));
            chart.curve(points);
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
