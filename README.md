# Media Replica

Utility to back up photos from a phone directory to a designated hard drive backup path and then import them into PhotoPrism (a self-hosted photo management tool). It uses `rsync` for file synchronization and `fs` for file handling in Node.js.

## Features

- Synchronizes photo directories from a phone to a hard disk.
- Filters out specific filenames to exclude from the backup.
- Imports backed up photos into PhotoPrism for management and viewing.
- Provides dry run capabilities to test the backup process without actual copying.
- Logs activities in a _logs_ directory.

## Prerequisites

- Node.js
- `rsync` command is in the PATH
- SSH access to the phone directory (I use [SimpleSSH](https://play.google.com/store/apps/details?id=com.begood.simplessh) on my phone)
- HDD connected to the host where this is running

## Usage

1. Create a _.env_ file based on the _.env.sample_
2. Run `yarn backup`

## Mounting External Disks

1. `df -h` to find out the Filesystem name of both hard disks
2. `umount [Filesystem]`
3. `mount [Filesystem] [path]`

In my case:

```bash
sudo umount /dev/sdd1
sudo umount /dev/sdb1
sudo mount /dev/sdd1 /mnt/drive1
sudo mount /dev/sdb1 /mnt/drive2
```

## TODOs

- rsync hdd1 with hdd2
- Make `phone` ssh url configurable
