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
- `rsync` command is in the PATH: make sure it's the [upstream rsync](https://github.com/RsyncProject/rsync), not macOS's built it rsync implementation, the latter is known to cause issues when reporting progress
- SSH access to the phone directory (I use [SimpleSSH](https://github.com/sutils/SimpleSSHD) on my phone)
- HDD connected to the host where this is running

## Usage

1. Create a _.env_ file based on the _.env.sample_
2. Run `yarn backup`

## Troubleshooting: Mismatched File Timestamps

If `rsync` reports existing files as needing sync due to mismatched modification times (mtime), this tool may incorrectly detect them as new files and attempt to re-import them into PhotoPrism, resulting in duplicates.

To resolve this, synchronize the timestamps on your backup disk without transferring files:

```sh
rsync -avt --existing --dry-run phone:[src] ./[dst]
```

This updates the mtime on the destination to match the source. Once complete, running `yarn backup` should correctly identify only new files.
