// Both entry points use the company on the page, including when another airline is logged in.
namespace AESRouteMap {
    function mapLink(player: string, airline: string) {
        const url = new URL('https://www.asroutemap.info/');
        url.search = new URLSearchParams({world: AES.getServerName(), player, airline}).toString();
        const link = document.createElement('a');
        link.href = url.href;
        link.textContent = AESI18n.t('AS Route Map');
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        return link;
    }

    function legacyLinks(scope: Element) {
        return Array.from(scope.querySelectorAll<HTMLAnchorElement>('a[href*="asroutemap.info/"]')).filter(link =>
            /^(www\.)?asroutemap\.info$/i.test(link.hostname) &&
            /^\/(rm|updatefpn)\.asp$/i.test(link.pathname));
    }

    function removeLegacyLink(link: HTMLAnchorElement) {
        const separator = link.previousSibling;
        if (separator && /^\s*\|\s*$/.test(separator.textContent || '')) separator.remove();
        link.remove();
    }

    function maintain(root: Element, entry: Element, reconcile: () => void) {
        entry.classList.add('aes-route-map-entry');
        const sync = () => {
            // Some ASX insertions rebuild the surrounding HTML, cloning our existing entry.
            for (const copy of root.querySelectorAll('.aes-route-map-entry')) {
                if (copy !== entry) copy.remove();
            }
            reconcile();
        };
        sync();
        const observer = new MutationObserver(() => {
            if (AES.isPageOwner()) sync();
        });
        observer.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['href']});
        AES.whenPageOwnershipLost(() => {
            observer.disconnect();
            entry.remove();
        });
    }

    export function dashboard() {
        const info = document.querySelector<HTMLAnchorElement>('#enterprise-dashboard a[href*="enterprises/"][href*="tab=0"]');
        const airline = info?.pathname.match(/^\/app\/info\/enterprises\/(\d+)\/?$/)?.[1];
        const table = info?.closest('table');
        const player = document.querySelector('#as-navbar-meta-collapse .fa-user + .as-icon-label')?.textContent.trim();
        if (!table || !airline || !player) return;

        const row = document.createElement('tr');
        const label = document.createElement('th');
        label.textContent = AESI18n.t('AS Route Map');
        row.append(label);
        const link = mapLink(player, airline);
        link.textContent = AESI18n.t('Flight Map');
        row.insertCell().append(link);
        maintain(table, row, () => {
            for (const old of legacyLinks(table)) {
                const oldRow = old.closest('tr');
                if (oldRow?.querySelector('th')?.textContent.trim() === 'AS Route Map') oldRow.remove();
                else removeLegacyLink(old);
            }
            if (!table.contains(row)) {
                const body = table.tBodies[0];
                const infoRow = body?.querySelector('a[href*="enterprises/"][href*="tab=0"]')?.closest('tr');
                if (infoRow) infoRow.before(row);
                else body?.append(row);
            }
        });
    }

    export function overview(airline: string) {
        const controls = document.querySelector('.routeNetworkLink')?.parentElement;
        const player = document.querySelector('table td a[href*="users/"]')?.textContent.trim();
        if (!controls || !player) return;
        const entry = document.createElement('span');
        entry.append(' | ', mapLink(player, airline));
        // Wicket can replace the route controls when a haul filter is selected.
        const root = controls.closest('.as-panel, .as-fieldset') || controls.parentElement || controls;
        maintain(root, entry, () => {
            const current = root.querySelector('.routeNetworkLink')?.parentElement;
            if (!current) return;
            for (const old of legacyLinks(current)) removeLegacyLink(old);
            if (!current.contains(entry)) current.append(entry);
        });
    }
}
