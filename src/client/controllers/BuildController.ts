print("BuildController Loaded");

import { Controller, OnStart } from "@flamework/core";
import { Players, Workspace, UserInputService, ReplicatedStorage, TweenService } from "@rbxts/services";
import { RunService } from "@rbxts/services";
import { GridSize } from "shared/Buildata";

const player = Players.LocalPlayer;
const camera = Workspace.CurrentCamera!;
const mouse = player.GetMouse();
const playergui = player.WaitForChild("PlayerGui") as PlayerGui;

const placeBlockEvent = ReplicatedStorage.WaitForChild("PlaceBlock") as RemoteEvent;
const deleteBlockEvent = ReplicatedStorage.WaitForChild("DeleteBlock") as RemoteEvent;

const PREVIEW_COLOR = new BrickColor("Bright blue");
const DELETE_COLOR = new BrickColor("Bright red");
const MAX_REACH = 50;

const BlockFolder = Workspace.WaitForChild("PlacedBlocks") as Folder;

const buildmodeui = playergui.WaitForChild("BuildModeUI") as ScreenGui;
const BuildLabel = buildmodeui.WaitForChild("BuildMode") as TextLabel;
const DeleteButton = buildmodeui.WaitForChild("Delete") as TextButton;
const rotateButton = buildmodeui.WaitForChild("Rotate") as TextButton;

let buildMode = false;
let deleteMode = false;
let currentRotation = 0;

let lastHovered: BasePart | undefined;

let isHoldingMouse = false;

const tweeninfo = new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
const tweeninfo2 = new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);

const deleteButtonSize = new UDim2(0, 220, 0, 55);

const tweenDeleteOn = TweenService.Create(DeleteButton, tweeninfo, {
	Size: deleteButtonSize,
});

const tweenRotateOn = TweenService.Create(rotateButton, tweeninfo, {
	Size: deleteButtonSize,
});

const tweenDeleteOff = TweenService.Create(DeleteButton, tweeninfo, {
	Size: new UDim2(0, 200, 0, 50),
});

const tweenRotateOff = TweenService.Create(rotateButton, tweeninfo, {
	Size: new UDim2(0, 200, 0, 50),
});

const tweenlabel = TweenService.Create(BuildLabel, tweeninfo, {
	Position: new UDim2(0.415, 0, 0.824, 0),
});

const tweenDelete = TweenService.Create(DeleteButton, tweeninfo2, {
	Position: new UDim2(0.589, 0, 0.926, 0),
});

const tweenRotate = TweenService.Create(rotateButton, tweeninfo2, {
	Position: new UDim2(0.257, 0, 0.926, 0),
});

const tweenlabelOut = TweenService.Create(BuildLabel, tweeninfo, {
	Position: new UDim2(0.415, 0, 1, 0),
});

const tweenDeleteOut = TweenService.Create(DeleteButton, tweeninfo2, {
	Position: new UDim2(0.589, 0, 1, 0),
});

const tweenRotateOut = TweenService.Create(rotateButton, tweeninfo2, {
	Position: new UDim2(0.257, 0, 1, 0),
});

DeleteButton.Activated.Connect(() => {
	deleteMode = !deleteMode;

	if (deleteMode) {
		tweenDeleteOn.Play();
	} else {
		tweenDeleteOff.Play();
	}
});

rotateButton.Activated.Connect(() => {
	currentRotation = (currentRotation + 90) % 360;
});

function tweenIn() {
	tweenDelete.Play();
	tweenRotate.Play();
	tweenlabel.Play();
}

function tweenOut() {
	tweenDeleteOut.Play();
	tweenRotateOut.Play();
	tweenlabelOut.Play();
}

export function snapToGrid(position: Vector3): Vector3 {
	return new Vector3(
		math.round(position.X / GridSize) * GridSize + GridSize / 2,
		math.round(position.Y / GridSize) * GridSize + GridSize / 2,
		math.round(position.Z / GridSize) * GridSize + GridSize / 2,
	);
}

function CreatePreview(): Part {
	const preview = new Instance("Part");
	preview.Anchored = true;
	preview.CanCollide = false;
	preview.CastShadow = false;
	preview.Transparency = 0.5;
	preview.Size = new Vector3(GridSize, GridSize, GridSize);
	preview.BrickColor = PREVIEW_COLOR;
	preview.Parent = Workspace;
	preview.Name = "BuildPreview";
	return preview;
}

@Controller()
export class BuildController implements OnStart {
	onStart() {
		const preview = CreatePreview();
		preview.Transparency = 1;

		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (input.KeyCode === Enum.KeyCode.Tab) {
				buildMode = !buildMode;
				deleteMode = false;
				preview.Transparency = buildMode ? 0.5 : 1;

				if (buildMode) {
					tweenIn();
				} else {
					tweenOut();
				}
			}

			if (!buildMode) {
				return;
			}

			if (input.KeyCode === Enum.KeyCode.R) {
				currentRotation = (currentRotation + 90) % 360;
				print("rotated block");
			}

			if (input.KeyCode === Enum.KeyCode.F) {
				deleteMode = !deleteMode;
				preview.Transparency = deleteMode ? 1 : 0.5;

				if (deleteMode) {
					tweenDeleteOn.Play();
				} else {
					tweenDeleteOff.Play();
				}
			}

			if (!gameProcessed && input.UserInputType === Enum.UserInputType.MouseButton1) {
				isHoldingMouse = true;
				const unitRay = camera.ScreenPointToRay(mouse.X, mouse.Y);
				const raycastParams = new RaycastParams();
				raycastParams.FilterDescendantsInstances = [preview];
				raycastParams.FilterType = Enum.RaycastFilterType.Exclude;

				const result = Workspace.Raycast(unitRay.Origin, unitRay.Direction.mul(MAX_REACH), raycastParams);

				if (!result) return;

				if (deleteMode) {
					const hit = result.Instance;
					if (hit && hit.IsA("BasePart")) {
						deleteBlockEvent.FireServer(hit);
					}
				} else {
					const snapped = snapToGrid(result.Position);
					placeBlockEvent.FireServer(snapped, currentRotation);
				}
			}
		});

		UserInputService.InputEnded.Connect((input) => {
			if (input.UserInputType === Enum.UserInputType.MouseButton1) {
				isHoldingMouse = false;
			}
		});

		RunService.RenderStepped.Connect(() => {
			if (!buildMode) return;

			const unitRay = camera.ScreenPointToRay(mouse.X, mouse.Y);
			const raycastParams = new RaycastParams();
			raycastParams.FilterDescendantsInstances = [preview];
			raycastParams.FilterType = Enum.RaycastFilterType.Exclude;

			const result = Workspace.Raycast(unitRay.Origin, unitRay.Direction.mul(MAX_REACH), raycastParams);

			if (lastHovered) {
				lastHovered.BrickColor = new BrickColor("Medium stone grey");
				lastHovered.Transparency = 0;
				lastHovered = undefined;
			}

			if (result) {
				if (deleteMode) {
					preview.Transparency = 1;

					const hit = result.Instance;
					if (hit && hit.IsA("BasePart") && hit.Parent === BlockFolder) {
						hit.BrickColor = new BrickColor("Bright red");
						hit.Transparency = 0.5;
						lastHovered = hit;

						if (isHoldingMouse) {
							deleteBlockEvent.FireServer(hit);
							lastHovered = undefined;
						}
					}
					return;
				}

				const hitposition = result.Position;
				const snapped = snapToGrid(hitposition);
				preview.Transparency = 0.5;
				preview.CFrame = new CFrame(snapped).mul(CFrame.Angles(0, math.rad(currentRotation), 0));

				if (isHoldingMouse) {
					placeBlockEvent.FireServer(snapped, currentRotation);
				}
			} else {
				preview.Transparency = 1;
			}
		});
	}
}
