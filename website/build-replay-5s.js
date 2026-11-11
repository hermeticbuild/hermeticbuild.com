import { startReplay } from './replay-controls.js';

(() => {
  const duration = 5000;
  const analysisEnd = 350;
  const format = new Intl.NumberFormat('en-US');

  // Action messages and dependencies are adapted from rules_img/e2e/disk.
  // The replay uses a Rust service and authored action counts and timings.
  const kernelSources = [
    'init/main.c', 'kernel/sched/core.c', 'mm/page_alloc.c',
    'fs/ext4/inode.c', 'net/core/dev.c', 'drivers/virtio/virtio.c',
  ];
  const kernelBatches = Array.from({ length: 128 }, (_, index) => ({
    start: 420 + (index * 137) % 730,
    end: 2000 + (index * 173) % 1220,
    count: 18,
    message: 'Compiling ' + kernelSources[index % kernelSources.length],
  }));
  const packaging = [
    [350, 420, 'Compiling tools/objtool/objtool.c'],
    [365, 1780, 'Compiling Rust bin //hello:hello (1 file)'],
    [390, 1810, 'Assembling Debian userspace'],
    [630, 2000, 'LayerCpio initrd/initrd.cpio.gz'],
    [1820, 2400, 'LayerErofs rootfs/root_layer.erofs'],
    [1930, 2460, 'LayerExt4 state/var_layer.ext4'],
    [2150, 2620, 'LayerExt4 state/home_layer.ext4'],
    [3240, 3670, 'Linking vmlinux'],
    [3670, 4120, 'Building unified kernel image boot/uki.efi'],
    [4120, 4530, 'LayerFat32 boot/esp_layer.fat32'],
    [4530, duration, 'DiskImage disk.img'],
  ].map(([start, end, message]) => ({ start, end, message, count: 1 }));
  const remoteActions = [...kernelBatches, ...packaging].sort((a, b) => a.start - b.start);
  const cacheBatches = [
    { end: 470, count: 96 },
    { end: 820, count: 256 },
    { end: 1180, count: 384 },
  ];
  const internal = 12;
  const countActions = actions => actions.reduce((total, action) => total + action.count, 0);
  const cacheHits = countActions(cacheBatches);
  const remote = countActions(remoteActions);
  const total = cacheHits + internal + remote;
  const peak = Math.max(...remoteActions.map(({ start }) =>
    countActions(remoteActions.filter(action => action.start <= start && start < action.end)),
  ));

  const analyzed = 'INFO: Analyzed target //:disk (96 packages loaded, 4241 targets configured).';
  const summary = [
    analyzed,
    'INFO: Found 1 target...',
    'Target //:disk up-to-date:',
    '  bazel-bin/disk.img',
    'INFO: Elapsed time: 5.000s, Critical Path: 4.53s',
    'INFO: ' + total + ' processes: ' + cacheHits + ' remote cache hit, ' + internal + ' internal, ' + remote + ' remote.',
    'INFO: Build completed successfully, ' + total + ' total actions',
  ].join('\n');

  const replay = document.querySelector('.build-replay');
  const output = replay.querySelector('.build-output');

  function render(time) {
    if (time < 100) {
      output.textContent = 'Computing main repo mapping:';
      return;
    }
    if (time < analysisEnd) {
      output.textContent = 'Analyzing: target //:disk ('
        + Math.min(96, Math.floor(time / 3)) + ' packages loaded, '
        + Math.min(4241, Math.floor(time * 12)) + ' targets configured)';
      return;
    }
    if (time === duration) {
      output.textContent = summary;
      return;
    }

    const active = remoteActions.filter(action => action.start <= time && time < action.end);
    const completed = internal
      + countActions(cacheBatches.filter(action => time >= action.end))
      + countActions(remoteActions.filter(action => time >= action.end));
    const progress = '[' + format.format(completed) + ' / ' + format.format(total) + ']';
    const describe = action => action.message + '; ' + Math.floor((time - action.start) / 1000) + 's remote';
    const running = countActions(active);

    if (running <= 1) {
      const detail = running === 1 ? describe(active[0]) : 'checking cached actions';
      output.textContent = analyzed + '\n' + progress + ' ' + detail;
      return;
    }

    const sample = [];
    const seen = new Set();
    for (const action of active) {
      if (seen.has(action.message)) continue;
      seen.add(action.message);
      sample.push('    ' + describe(action));
      if (sample.length === 3) break;
    }
    if (running > sample.length) sample[sample.length - 1] += ' ...';
    output.textContent = [analyzed, progress + ' ' + running + ' actions running', ...sample].join('\n');
  }

  startReplay(replay, {
    duration,
    renderInterval: 85,
    render,
    completionMessage: 'UEFI disk image complete in five seconds. Peak '
      + format.format(peak) + ' remote actions running.',
  });
})();
