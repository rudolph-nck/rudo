#!/usr/bin/env bash
# Resumable master render: renders silent video in chunks (skips chunks already
# done), then joins them losslessly and muxes the original AAC audio.
set -u
cd "$(dirname "$0")/.."
OUT=renders/final/one-team-one-rhythm.mp4
CH=renders/final/chunks
mkdir -p "$CH"
TOTAL=8460; N=6; SIZE=$(( (TOTAL + N - 1) / N ))
: > "$CH/list.txt"
for i in $(seq 0 $((N-1))); do
  a=$(( i * SIZE )); b=$(( a + SIZE - 1 )); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  f="$CH/part_$i.mp4"
  if [ ! -f "$f.done" ]; then
    echo "chunk $i: frames $a-$b"
    npx remotion render src/index.ts FilmSilent "$f" --frames=$a-$b --concurrency=4 --crf=19 --muted --log=error || exit 1
    touch "$f.done"
  else
    echo "chunk $i: already done"
  fi
  echo "file 'part_$i.mp4'" >> "$CH/list.txt"
done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$CH/list.txt" -i assets/audio/one-team-one-rhythm.m4a -map 0:v -map 1:a -c copy -shortest -movflags +faststart "$OUT" || exit 1
echo "MASTER DONE: $OUT"
