import os, signal, re, glob, sys

def kill_port(port):
    inode_set = set()
    for f in ['/proc/net/tcp', '/proc/net/tcp6']:
        try:
            lines = open(f).readlines()
            for line in lines[1:]:  # skip header
                parts = line.split()
                if len(parts) < 10:
                    continue
                local = parts[1]
                try:
                    p = int(local.split(':')[-1], 16)
                except ValueError:
                    continue
                if p == port:
                    inode_set.add(parts[9])
        except Exception:
            pass
    if not inode_set:
        print(f'no process on port {port}')
        return
    killed = False
    for fd_path in glob.glob('/proc/*/fd/*'):
        try:
            link = os.readlink(fd_path)
            m = re.search(r'socket:\[(\d+)\]', link)
            if m and m.group(1) in inode_set:
                pid = int(fd_path.split('/')[2])
                print(f'killing pid {pid}')
                os.kill(pid, signal.SIGTERM)
                killed = True
        except Exception:
            pass
    if not killed:
        print(f'found inode but could not kill')

kill_port(int(sys.argv[1]))
