/** Shared sorting for user actions and refreshed rows. Reads each cell once. */
namespace AESDashboardTable {
    export function parseNumber(value: unknown) {
        if (value === undefined || value === null) return NaN;
        return parseFloat(String(value).replace(/,/g,'').replace(/[^0-9.-]/g,''));
    }
    export function sort(table: JQuery, columnClass: string, numeric: boolean, ascending?: boolean) {
        const rows=table.find('tbody tr').toArray().map(row=>{
            const text=$(row).children('.'+columnClass).text();
            return {row,value:numeric ? parseNumber(text)||0 : text};
        });
        const compare=(a: string | number,b: string | number)=>a<b ? -1 : a>b ? 1 : 0;
        if (ascending === undefined) {
            const distinct=[...new Set(rows.map(item=>item.value))];
            const initial=[...distinct].sort((a,b)=>compare(a,b)*(numeric ? -1 : 1));
            const same=distinct.every((value,index)=>value===initial[index]);
            ascending=same ? numeric : !numeric;
        }
        rows.sort((a,b)=>compare(a.value,b.value)*(ascending ? 1 : -1));
        // Moving existing nodes preserves checkbox state, event handlers and row data.
        table.find('tbody').append(rows.map(item=>item.row));
        table.find('th[data-aes-sort-column]').each((_,header)=>{
            header.setAttribute('aria-sort',header.getAttribute('data-aes-sort-column')===columnClass ? (ascending ? 'ascending' : 'descending') : 'none');
        });
        table.data('aesSort',{columnClass,number:numeric,ascending});
    }
}
