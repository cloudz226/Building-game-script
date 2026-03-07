import { Service, OnStart } from "@flamework/core";
import { Players, TweenService } from "@rbxts/services";
import { GridSize } from "shared/Buildata";

print("buildService Loaded");

const replicatedStorage = game.GetService("ReplicatedStorage");
const workspace = game.GetService("Workspace");

const placeBlockEvent = new Instance("RemoteEvent");
placeBlockEvent.Name = "PlaceBlock";
placeBlockEvent.Parent = replicatedStorage;

const deleteBlockEvent = new Instance("RemoteEvent");
deleteBlockEvent.Name = "DeleteBlock";
deleteBlockEvent.Parent = replicatedStorage;

if (!placeBlockEvent || !deleteBlockEvent) {
	warn("Failed to create remote events");
}

const blocksFolder = new Instance("Folder");
blocksFolder.Name = "PlacedBlocks";
blocksFolder.Parent = workspace;

if (!blocksFolder) {
	warn("Failed to create blocks folder");
}

const lastAction = new Map<Player, number>();

const tweenInfo = new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
const tweenInfo2 = new TweenInfo(0.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
const tweenInfo3 = new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);


// checks if a block has already been placed on the grid

function isOccupied(position: Vector3): boolean {
	for (const block of blocksFolder.GetChildren()) {
		if (block.IsA("BasePart")) {
			if (block.Position.sub(position).Magnitude < 0.1) {
				return true;
			}
		}
	}
	return false;
}

// checks if a block has already been placed on the grid


export function snapToGrid(position: Vector3): Vector3 {
	print("snapped to most nearby Grid");
	return new Vector3(
		math.round(position.X / GridSize) * GridSize + GridSize / 2,
		math.round(position.Y / GridSize) * GridSize - GridSize / 2,
		math.round(position.Z / GridSize) * GridSize + GridSize / 2,
	);
}

// snaps to grid

@Service()
export class BuildService implements OnStart {
	onStart() {
		Players.PlayerRemoving.Connect((player) => {
			lastAction.delete(player);
		});

		placeBlockEvent.OnServerEvent.Connect((player, RawPosition, RawRotation) => {
			const position = RawPosition as Vector3;
			const rotation = RawRotation as number;

			const SizeBeforeTween = GridSize * 0.25;
			const OvershootSize = GridSize * 1.1;

			if (!position || rotation === undefined) return;

			const now = os.clock();
			const last = lastAction.get(player) ?? 0;
			if (now - last < 0.05) return;
			lastAction.set(player, now);

			const snappedPosition = position;

			if (isOccupied(position)) return;

			const block = new Instance("Part");
			block.Size = new Vector3(SizeBeforeTween, SizeBeforeTween, SizeBeforeTween);
			block.Position = snappedPosition;
			block.CFrame = new CFrame(snappedPosition).mul(CFrame.Angles(0, math.rad(rotation), 0));
			block.Anchored = true;
			block.Material = Enum.Material.SmoothPlastic;
			block.Parent = blocksFolder;

			// Creates a Basic block

			const tween = TweenService.Create(block, tweenInfo, {
				Size: new Vector3(OvershootSize, OvershootSize, OvershootSize),
			});
			tween.Play();
			tween.Completed.Connect(() => {
				const tween2 = TweenService.Create(block, tweenInfo2, {
					Size: new Vector3(GridSize, GridSize, GridSize),
				});
				tween2.Play();
			});
		});

		//smoothly tweens the blocks in when placed

		deleteBlockEvent.OnServerEvent.Connect((player, RawBlock) => {
			const block = RawBlock as BasePart;
			if (!block || !block.IsA("BasePart")) return; //returns if its not a block/block is not a basepart
			if (block.Parent !== blocksFolder) return; // returns if the blocks parent is not equal to the blocksfolder

			const now = os.clock();
			const last = lastAction.get(player) ?? 0;
			if (now - last < 0.05) return; // cooldown
			lastAction.set(player, now);

			const tween = TweenService.Create(block, tweenInfo3, {
				Size: new Vector3(0.1, 0.1, 0.1),
				Transparency: 1,
			});
			
			tween.Play();
			tween.Completed.Connect(() => {
				block.Destroy();
			});

			//smoothly tweens the block out
		});
	}
}
