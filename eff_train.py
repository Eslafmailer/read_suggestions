import tensorflow as tf
import os
from tensorflow.keras.applications.efficientnet import EfficientNetB0, preprocess_input

# Paths and parameters
IMAGES_FOLDER = os.path.join('.', 'images')
IMAGE_SIZE = (224, 224)
IMAGE_SHAPE = (*IMAGE_SIZE, 3)
BATCH_SIZE = 32
NUM_EPOCHS = 15

# Load datasets with validation split
train_ds = tf.keras.utils.image_dataset_from_directory(
    IMAGES_FOLDER,
    label_mode='binary',
    validation_split=0.2,
    subset="training",
    seed=42,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
)

val_ds = tf.keras.utils.image_dataset_from_directory(
    IMAGES_FOLDER,
    label_mode='binary',
    validation_split=0.2,
    subset="validation",
    seed=42,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
)

# Data augmentation pipeline (only for training data)
data_augmentation = tf.keras.Sequential([
    tf.keras.layers.RandomFlip("horizontal"),
    tf.keras.layers.RandomRotation(0.1),
    tf.keras.layers.RandomZoom(0.1),
])

AUTOTUNE = tf.data.AUTOTUNE

def augment_images(images, labels):
    images = data_augmentation(images)
    return images, labels

train_ds = train_ds.map(lambda x, y: (preprocess_input(x), y))
val_ds = val_ds.map(lambda x, y: (preprocess_input(x), y))

train_ds = train_ds.map(augment_images, num_parallel_calls=AUTOTUNE)

train_ds = train_ds.shuffle(1000).prefetch(buffer_size=AUTOTUNE)
val_ds = val_ds.prefetch(buffer_size=AUTOTUNE)

# Load EfficientNetB0 base model with pretrained weights, exclude top layers
base_model = EfficientNetB0(input_shape=IMAGE_SHAPE, include_top=False, weights='imagenet')
base_model.trainable = False  # Freeze base model initially

# Build the model
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(input_shape=IMAGE_SHAPE),
    base_model,
    tf.keras.layers.GlobalAveragePooling2D(),
    tf.keras.layers.Dense(64, activation='relu'),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(1, activation='sigmoid')
])

model.compile(
    optimizer=tf.keras.optimizers.Adam(),
    loss=tf.keras.losses.BinaryCrossentropy(),
    metrics=["accuracy"]
)

model.summary()

# Callbacks for early stopping and learning rate reduction
callbacks = [
    tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=3, restore_best_weights=True),
    tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=2, min_lr=1e-7),
]

# Initial training
history = model.fit(
    train_ds,
    epochs=NUM_EPOCHS,
    validation_data=val_ds,
    callbacks=callbacks
)

# Fine-tuning: unfreeze some layers and continue training with low LR
base_model.trainable = True

fine_tune_at = 100  # freeze layers before this index
for layer in base_model.layers[:fine_tune_at]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-5),  # lower learning rate for fine-tuning
    loss=tf.keras.losses.BinaryCrossentropy(),
    metrics=["accuracy"]
)

fine_tune_epochs = 5
total_epochs = NUM_EPOCHS + fine_tune_epochs

history_fine = model.fit(
    train_ds,
    epochs=total_epochs,
    initial_epoch=history.epoch[-1],
    validation_data=val_ds,
    callbacks=callbacks
)

# Save the trained model
model.save(os.path.join('.', 'trained_binary_efficientnet'))

# Evaluate on validation dataset
loss0, accuracy0 = model.evaluate(val_ds)
print(f"Validation loss: {loss0:.4f}")
print(f"Validation accuracy: {accuracy0:.4f}")
